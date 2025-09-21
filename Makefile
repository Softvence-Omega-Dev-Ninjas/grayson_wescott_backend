# Docker image name
APP_IMAGE := sajibsv/grayson-server:latest

# Compose file
COMPOSE_FILE := compose.yaml

.PHONY: help build up down restart logs clean push

# Show available commands
help:
	@echo "Available commands:"
	@echo "  make build       Build the Docker image"
	@echo "  make up          Start containers using docker-compose"
	@echo "  make down        Stop containers"
	@echo "  make restart     Restart containers"
	@echo "  make logs        Show logs of the app container"
	@echo "  make clean       Remove containers, networks, volumes, and image"
	@echo "  make push        Push the Docker image to Docker Hub"

# Build the Docker image
build:
	docker build -t $(APP_IMAGE) .

# Start containers
up:
	docker compose -f $(COMPOSE_FILE) up -d --build

# Stop containers
down:
	docker compose -f $(COMPOSE_FILE) down

# Restart containers
restart: down up

# Show logs of the app container
logs:
	docker compose -f $(COMPOSE_FILE) logs -f grayson-server-api

# Cleanup everything
clean: down
	docker volume rm grayson_db files || true
	docker rmi $(APP_IMAGE) || true

# Push to Docker Hub
push: build
	docker push $(APP_IMAGE)
