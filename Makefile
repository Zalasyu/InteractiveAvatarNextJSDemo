.PHONY: help install dev build start lint lint-fix clean env-check test-adapter all

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)LiveAvatar - Available Make Targets$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

dev: env-check ## Start development server (localhost:3000)
	@echo "$(BLUE)Starting development server...$(NC)"
	npm run dev

build: env-check ## Build for production
	@echo "$(BLUE)Building application...$(NC)"
	npm run build
	@echo "$(GREEN)✓ Build complete$(NC)"

start: ## Start production server
	@echo "$(BLUE)Starting production server...$(NC)"
	npm start

lint: ## Run ESLint checks
	@echo "$(BLUE)Running linter...$(NC)"
	npm run lint

lint-fix: ## Run ESLint and auto-fix issues
	@echo "$(BLUE)Running linter with auto-fix...$(NC)"
	npx eslint . --ext .ts,.tsx,.js,.jsx --fix
	@echo "$(GREEN)✓ Linting complete$(NC)"

clean: ## Clean build artifacts and dependencies
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf .next
	rm -rf node_modules
	rm -rf package-lock.json
	@echo "$(GREEN)✓ Clean complete$(NC)"

env-check: ## Check if required environment variables are set
	@if [ ! -f .env ]; then \
		echo "$(RED)⚠ Warning: .env file not found$(NC)"; \
		echo "$(YELLOW)Required variables: HEYGEN_API_KEY, NEXT_PUBLIC_BASE_API_URL, CUSTOM_LLM_API_URL$(NC)"; \
	else \
		echo "$(GREEN)✓ .env file found$(NC)"; \
	fi

test-adapter: ## Run adapter compatibility test
	@if [ -f test-adapter-compatibility.ts ]; then \
		echo "$(BLUE)Running adapter compatibility test...$(NC)"; \
		npx ts-node test-adapter-compatibility.ts; \
	else \
		echo "$(RED)⚠ test-adapter-compatibility.ts not found$(NC)"; \
	fi

setup: install env-check ## Complete setup (install + env check)
	@echo "$(GREEN)✓ Setup complete! Run 'make dev' to start development$(NC)"

all: clean install build ## Clean, install, and build

# Development workflow shortcuts
quick-start: install dev ## Quick start: install and run dev server

rebuild: clean install build ## Clean rebuild from scratch
