//! A small fully connected network and the file its weights come in, written by the lab after training.
//!
//! The file is little-endian: the 4 bytes `BRNN`, the format version as a `u32`, the number of layers as a `u32`,
//! then for each layer its inputs and outputs as two `u32`, its weights as `outputs × inputs` `f32` (one row per
//! output) and its biases as `outputs` `f32`. Every layer but the last is followed by a ReLU.

use std::fmt;

use crate::rng::Rng;

const MAGIC: &[u8; 4] = b"BRNN";
const VERSION: u32 = 1;

#[derive(Clone, Debug, PartialEq)]
struct Layer {
    inputs: usize,
    outputs: usize,
    weights: Vec<f32>,
    biases: Vec<f32>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Network {
    layers: Vec<Layer>,
}

/// Why a weights file was rejected.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum WeightsError {
    NotWeights,
    Version(u32),
    Truncated,
    TrailingBytes,
    /// A layer's inputs differ from the outputs before it, or the network has no layer.
    Shape,
}

impl fmt::Display for WeightsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WeightsError::NotWeights => write!(f, "not a weights file"),
            WeightsError::Version(v) => write!(f, "weights format {v}, expected {VERSION}"),
            WeightsError::Truncated => write!(f, "the weights file ends too early"),
            WeightsError::TrailingBytes => write!(f, "bytes after the last layer"),
            WeightsError::Shape => write!(f, "the layers do not fit together"),
        }
    }
}

impl std::error::Error for WeightsError {}

struct Reader<'a> {
    bytes: &'a [u8],
}

impl Reader<'_> {
    fn take(&mut self, n: usize) -> Result<&[u8], WeightsError> {
        if self.bytes.len() < n {
            return Err(WeightsError::Truncated);
        }
        let (head, rest) = self.bytes.split_at(n);
        self.bytes = rest;
        Ok(head)
    }

    fn u32(&mut self) -> Result<u32, WeightsError> {
        Ok(u32::from_le_bytes(
            self.take(4)?.try_into().expect("4 bytes"),
        ))
    }

    fn f32s(&mut self, n: usize) -> Result<Vec<f32>, WeightsError> {
        let len = n.checked_mul(4).ok_or(WeightsError::Truncated)?;
        Ok(self
            .take(len)?
            .as_chunks::<4>()
            .0
            .iter()
            .map(|&b| f32::from_le_bytes(b))
            .collect())
    }
}

impl Network {
    /// A network from `(weights, biases)` per layer, weights one row per output. Panics if the layers do not fit.
    pub fn new(layers: Vec<(Vec<Vec<f32>>, Vec<f32>)>) -> Network {
        let layers: Vec<Layer> = layers
            .into_iter()
            .map(|(rows, biases)| Layer {
                inputs: rows.first().map_or(0, Vec::len),
                outputs: rows.len(),
                weights: rows.concat(),
                biases,
            })
            .collect();
        let network = Network { layers };
        assert!(network.fits(), "the layers do not fit together");
        network
    }

    /// An untrained network of the given layer sizes, its weights and biases drawn uniformly from −0.5 to 0.5.
    pub fn random(sizes: &[usize], rng: &mut Rng) -> Network {
        let mut x = || (rng.next_u64() >> 40) as f32 / (1u64 << 24) as f32 - 0.5;
        let layers = sizes
            .windows(2)
            .map(|w| Layer {
                inputs: w[0],
                outputs: w[1],
                weights: (0..w[0] * w[1]).map(|_| x()).collect(),
                biases: (0..w[1]).map(|_| x()).collect(),
            })
            .collect();
        let network = Network { layers };
        assert!(network.fits(), "a network needs at least two sizes");
        network
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Network, WeightsError> {
        let mut reader = Reader { bytes };
        if reader.take(4).map_err(|_| WeightsError::NotWeights)? != MAGIC {
            return Err(WeightsError::NotWeights);
        }
        let version = reader.u32()?;
        if version != VERSION {
            return Err(WeightsError::Version(version));
        }
        let count = reader.u32()?;
        let mut layers = Vec::new();
        for _ in 0..count {
            let inputs = reader.u32()? as usize;
            let outputs = reader.u32()? as usize;
            let weights =
                reader.f32s(inputs.checked_mul(outputs).ok_or(WeightsError::Truncated)?)?;
            let biases = reader.f32s(outputs)?;
            layers.push(Layer {
                inputs,
                outputs,
                weights,
                biases,
            });
        }
        if !reader.bytes.is_empty() {
            return Err(WeightsError::TrailingBytes);
        }
        let network = Network { layers };
        if !network.fits() {
            return Err(WeightsError::Shape);
        }
        Ok(network)
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = MAGIC.to_vec();
        let put = |bytes: &mut Vec<u8>, n: usize| {
            bytes.extend_from_slice(&u32::try_from(n).expect("a layer fits a u32").to_le_bytes())
        };
        put(&mut bytes, VERSION as usize);
        put(&mut bytes, self.layers.len());
        for layer in &self.layers {
            put(&mut bytes, layer.inputs);
            put(&mut bytes, layer.outputs);
            for x in layer.weights.iter().chain(&layer.biases) {
                bytes.extend_from_slice(&x.to_le_bytes());
            }
        }
        bytes
    }

    fn fits(&self) -> bool {
        !self.layers.is_empty()
            && self
                .layers
                .iter()
                .all(|l| l.weights.len() == l.inputs * l.outputs && l.biases.len() == l.outputs)
            && self.layers.windows(2).all(|w| w[0].outputs == w[1].inputs)
    }

    pub fn inputs(&self) -> usize {
        self.layers[0].inputs
    }

    pub fn outputs(&self) -> usize {
        self.layers[self.layers.len() - 1].outputs
    }

    /// The widest layer, the size of the buffers [`forward`](Self::forward) needs.
    pub fn width(&self) -> usize {
        self.layers
            .iter()
            .map(|l| l.outputs.max(l.inputs))
            .max()
            .unwrap_or(0)
    }

    /// The outputs for `input`, computed in `a` and `b`, which need [`width`](Self::width) numbers each; the result
    /// is a slice of one of them.
    pub fn forward<'a>(&self, input: &[f32], a: &'a mut [f32], b: &'a mut [f32]) -> &'a [f32] {
        assert_eq!(input.len(), self.inputs(), "the input's length");
        a[..input.len()].copy_from_slice(input);
        let (mut from, mut to) = (a, b);
        for (i, layer) in self.layers.iter().enumerate() {
            let rows = layer.weights.chunks_exact(layer.inputs);
            for ((out, row), bias) in to.iter_mut().zip(rows).zip(&layer.biases) {
                let mut sum = *bias;
                for (w, x) in row.iter().zip(&from[..layer.inputs]) {
                    sum += w * x;
                }
                *out = if i + 1 < self.layers.len() {
                    sum.max(0.0)
                } else {
                    sum
                };
            }
            std::mem::swap(&mut from, &mut to);
        }
        &from[..self.outputs()]
    }

    /// Every layer's outputs for `input`, the hidden ones after their ReLU. It allocates: it is for showing the
    /// network at work, not for playing.
    pub fn activations(&self, input: &[f32]) -> Vec<Vec<f32>> {
        let mut outputs: Vec<Vec<f32>> = Vec::with_capacity(self.layers.len());
        for (i, layer) in self.layers.iter().enumerate() {
            let from = outputs.last().map_or(input, Vec::as_slice);
            let rows = layer.weights.chunks_exact(layer.inputs);
            let out = rows
                .zip(&layer.biases)
                .map(|(row, bias)| {
                    let sum = row.iter().zip(from).fold(*bias, |sum, (w, x)| sum + w * x);
                    if i + 1 < self.layers.len() {
                        sum.max(0.0)
                    } else {
                        sum
                    }
                })
                .collect();
            outputs.push(out);
        }
        outputs
    }
}
