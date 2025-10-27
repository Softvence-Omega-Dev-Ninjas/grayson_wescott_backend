# Variables
DOCKER_USERNAME=softvence
PACKAGE_NAME=grayson_wescott
PACKAGE_VERSION=latest

# Docker image name
APP_IMAGE := $(DOCKER_USERNAME)/$(PACKAGE_NAME):$(PACKAGE_VERSION)

# Compose file
COMPOSE_FILE := compose.yaml

.PHONY: help build up down restart logs clean push containers volumes networks images

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
	@echo "  make containers  Show containers of current compose"
	@echo "  make volumes     Show volumes of current compose"
	@echo "  make networks    Show networks of current compose"
	@echo "  make images      Show images of current compose"

# Build the Docker image
build:
	docker build -t $(APP_IMAGE) .

# Start containers
up:
	docker compose -f $(COMPOSE_FILE) up

# Stop containers
down:
	docker compose -f $(COMPOSE_FILE) down

# Restart containers
restart: down up

# Show logs of the app container
logs:
	docker compose -f $(COMPOSE_FILE) logs -f $(PACKAGE_NAME)_api

# Cleanup everything
clean: down
	docker rm $(shell docker ps -a -q) || true
	docker rmi $(APP_IMAGE) || true

# Show containers of current compose
containers:
	docker compose -f $(COMPOSE_FILE) ps

# Show volumes of current compose
volumes:
	docker compose -f $(COMPOSE_FILE) volume ls

# Show networks of current compose
networks:
	docker compose -f $(COMPOSE_FILE) network ls

# Show images of current compose
images:
	docker compose -f $(COMPOSE_FILE) images

# Push to Docker Hub
push: build
	docker push $(APP_IMAGE)
