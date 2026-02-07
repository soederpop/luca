FROM runpod/stable-diffusion:web-ui-10.2.1

# Install curl if not present, then install Bun
RUN apt-get update && apt-get install -y curl \
  && curl -fsSL https://bun.sh/install | bash \
  && ln -s /root/.bun/bin/bun /usr/local/bin/bun

# Set the working directory
WORKDIR /app

# Copy necessary files and folders
COPY src ./src
COPY identities ./identities
COPY package.json .
COPY bun.lock .
COPY tsconfig.json .

# (Optional) Install dependencies with Bun
RUN bun install

# (Optional) Set default command
# CMD ["bun", "run", "start"]