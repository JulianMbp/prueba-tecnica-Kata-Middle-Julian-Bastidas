.PHONY: up down logs test install

up:
	docker-compose up --build

down:
	docker-compose down

logs:
	docker-compose logs -f

install:
	bash scripts/install-all.sh

test:
	bash scripts/run-all-tests.sh
