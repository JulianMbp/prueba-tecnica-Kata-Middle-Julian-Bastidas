.PHONY: up down logs test

up:
	docker-compose up --build

down:
	docker-compose down

logs:
	docker-compose logs -f

test:
	cd apps/api-gateway && npm test --if-present
	cd apps/release-service && npm test --if-present
	cd apps/rules-service && npm test --if-present
	cd apps/integration-service && npm test --if-present
	cd apps/notification-service && npm test --if-present
	cd apps/frontend && npm test --if-present
