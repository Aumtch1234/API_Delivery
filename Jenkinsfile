pipeline {
  agent any

  environment {
    DOCKER_COMPOSE = 'docker-compose.yml'
    PROJECT_NAME = 'delivery-api'
    DB_NAME = 'delivery'


    POSTGRES_USER = credentials('api_env')     // username
    POSTGRES_PASSWORD = credentials('api_env') // password
    PGADMIN_DEFAULT_EMAIL = credentials('api_env')
    PGADMIN_DEFAULT_PASSWORD = credentials('api_env')
  }

  stages {

    stage('Checkout') {
      steps {
        echo '📥 Pulling latest code...'
        git branch: 'main', url: 'https://github.com/Aumtch1234/Api_Delivery.git'
        sh 'git log --oneline -1'
      }
    }

    stage('Validate Environment') {
      steps {
        echo '✅ Validating environment and files...'
        sh '''
          if [ ! -f "$DOCKER_COMPOSE" ]; then
            echo "❌ docker-compose.yml not found!"
            exit 1
          fi
          
          if [ ! -f "Dockerfile" ]; then
            echo "❌ Dockerfile not found!"
            exit 1
          fi
          
          if [ ! -d "DB" ]; then
            echo "⚠️  DB folder not found"
          else
            echo "✅ Found DB directory"
          fi
        '''
      }
    }

    stage('Clean Old Resources') {
      steps {
        echo '🧹 Cleaning old containers and volumes...'
        sh '''
          set +e
          docker compose -f $DOCKER_COMPOSE down -v
          docker image prune -f
          docker volume prune -f
          set -e
        '''
      }
    }

    stage('Start Database Only') {
      steps {
        echo '🗄️ Starting PostgreSQL only...'
        sh '''
          docker compose -f $DOCKER_COMPOSE up -d postgres

          echo "⏳ Waiting for PostgreSQL to be ready..."
          MAX_ATTEMPTS=30
          ATTEMPT=0
          
          while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
            if docker exec postgres pg_isready -U postgres > /dev/null 2>&1; then
              echo "✅ PostgreSQL is ready!"
              break
            fi
            ATTEMPT=$((ATTEMPT + 1))
            echo "⏳ Waiting... (Attempt $ATTEMPT/$MAX_ATTEMPTS)"
            sleep 2
          done
          
          if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
            echo "❌ PostgreSQL failed to start!"
            docker logs postgres
            exit 1
          fi
        '''
      }
    }

    stage('Initialize Database Schema') {
      steps {
        echo '🌱 Initializing database schema...'
        sh '''
          if [ -f "DB/init.sql" ]; then
            echo "📦 Importing DB/init.sql..."
            docker exec -i postgres psql -U postgres -d $DB_NAME < DB/init.sql
            echo "✅ Database schema imported successfully"
          else
            echo "⚠️  No DB/init.sql found, skipping schema import"
          fi
        '''
      }
    }

    stage('Build Docker Images') {
      steps {
        echo '🔨 Building Docker images...'
        sh '''
          docker compose -f $DOCKER_COMPOSE build --no-cache
          echo "✅ Build completed successfully"
        '''
      }
    }

    stage('Start All Services') {
      steps {
        echo '🚀 Starting API and pgAdmin...'
        sh '''
          docker compose -f $DOCKER_COMPOSE up -d
          echo "⏳ Waiting for services to start..."
          sleep 5
          docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        '''
      }
    }

    stage('Wait for API to Start') {
      steps {
        echo '⏳ Waiting for Express API to respond...'
        sh '''
          MAX_ATTEMPTS=20
          ATTEMPT=0

          while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
            if curl -s http://localhost:4000 > /dev/null 2>&1; then
              echo "✅ API is responding!"
              break
            fi
            ATTEMPT=$((ATTEMPT + 1))
            echo "⏳ Waiting for API... ($ATTEMPT/$MAX_ATTEMPTS)"
            sleep 3
          done

          if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
            echo "❌ API did not respond in time"
            docker logs api-delivery
            exit 1
          fi
        '''
      }
    }

    stage('Health Check') {
      steps {
        echo '🔍 Performing health checks...'
        sh '''
          echo "=== Container Status ==="
          docker ps --format "table {{.Names}}\t{{.State}}\t{{.Status}}"

          echo "=== PostgreSQL Health ==="
          docker exec postgres psql -U postgres -d $DB_NAME -c "SELECT NOW();" || echo "Unable to connect"

          echo "=== API Health ==="
          curl -s -o /dev/null -w "Status: %{http_code}\\n" http://localhost:4000/ || echo "Not responding"
        '''
      }
    }

    stage('Verify Application') {
      steps {
        echo '✅ Verifying application deployment...'
        sh '''
          echo "API: http://localhost:4000"
          echo "PgAdmin: http://localhost:8081"
          echo ""
          echo "Container Logs (Last 20 lines of API):"
          docker logs --tail=20 api-delivery || true
        '''
      }
    }

  }

  post {
    success {
      echo '🎉 CI/CD pipeline completed successfully!'
      echo 'API is running at http://localhost:4000'
      echo 'PgAdmin is available at http://localhost:8081'
    }
    failure {
      echo '❌ Pipeline failed!'
      sh '''
        echo "=== Debug Information ==="
        docker ps -a
        echo "=== Last Docker Logs ==="
        docker compose -f $DOCKER_COMPOSE logs --tail=100 || true
      '''
    }
    always {
      echo '🧹 Pipeline finished'
    }
  }
}
