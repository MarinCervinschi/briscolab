# The site as static files: the engine compiled to WebAssembly, every page prerendered, then served by nginx.
FROM node:24-bookworm-slim AS build
ARG TARGETARCH
ENV PATH=/root/.cargo/bin:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# gcc links the build scripts and proc macros, which run on the build machine.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates curl gcc libc6-dev \
	&& rm -rf /var/lib/apt/lists/*
RUN curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain 1.99.1 --target wasm32-unknown-unknown
# The CLI must be the version of the wasm-bindgen crate in engine/wasm/Cargo.toml.
RUN case "$TARGETARCH" in arm64) arch=aarch64 ;; *) arch=x86_64 ;; esac \
	&& name="wasm-bindgen-0.2.129-$arch-unknown-linux-musl" \
	&& curl -sSfL "https://github.com/wasm-bindgen/wasm-bindgen/releases/download/0.2.129/$name.tar.gz" \
	| tar -xz -C /usr/local/bin --strip-components=1 "$name/wasm-bindgen"
RUN corepack enable

WORKDIR /src
COPY web/package.json web/pnpm-lock.yaml web/
RUN cd web && pnpm install --frozen-lockfile
COPY engine engine
COPY lab/results lab/results
COPY web web
# Umami's script and site, given by the deploy; without them the site sends no analytics.
ARG VITE_UMAMI_SCRIPT_URL
ARG VITE_UMAMI_WEBSITE_ID
# The prerender starts a server on localhost and fetches 127.0.0.1; in a container localhost resolves to ::1 first.
RUN cd web && NODE_OPTIONS=--dns-result-order=ipv4first pnpm build

FROM nginx:1.29-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/web/dist/client /usr/share/nginx/html
EXPOSE 8080
