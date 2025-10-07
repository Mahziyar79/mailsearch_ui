# Use a lightweight Python image
FROM python:3.12-slim

# Set working directory inside the container
WORKDIR /app

# Copy all files from current directory to /app in container
COPY . /app

# Expose the port that the server will run on (default is 8080)
EXPOSE 8080

# Run the server script
CMD ["python", "server.py"]