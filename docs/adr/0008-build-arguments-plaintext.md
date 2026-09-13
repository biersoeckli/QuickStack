# App Build Arguments are plaintext Docker build arguments

An **App** can declare **App Build Arguments** that QuickStack passes to a Dockerfile build as BuildKit `build-arg` options, stored plaintext alongside runtime environment variables. Values therefore appear in image metadata and build-job output and must not hold secrets. We chose this over BuildKit secret mounts because secrets require the user to author `RUN --mount=type=secret` in their Dockerfile, which changes the user contract; plaintext `ARG` matches how Dockerfile authors already expect build arguments to work.
