# Use an official Node runtime as a parent image, based on Debian/Ubuntu
FROM node:18-bullseye-slim

# Install Python 3, pip, and virtualenv
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the entire project (backend, scraper, frontend)
COPY . .

# --- Setup Python Scraper ---
WORKDIR /app/scraper
# Create a virtual environment and install dependencies
RUN python3 -m venv .venv
RUN .venv/bin/pip install --no-cache-dir -r requirements.txt

# --- Setup Node.js Backend ---
WORKDIR /app/backend
# Install Node dependencies
RUN npm install

# Expose the port the backend runs on
EXPOSE 5000

# Set environment variables so the backend knows where to find Python
ENV PYTHON_CMD=/app/scraper/.venv/bin/python3
ENV PORT=5000

# Run the Node.js backend
CMD ["node", "server.js"]
