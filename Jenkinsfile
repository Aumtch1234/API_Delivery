pipeline {
  agent any

  environment {
    DOCKER_COMPOSE = 'docker-compose.yml'
    PROJECT_NAME = 'delivery-api'
    DB_NAME = 'delivery'
  }

  stages {

    stage('Checkout') {
      steps {
        echo '📥 Pulling latest code...'
        git branch: 'main', url: 'https://github.com/Aumtch1234/Api_Delivery.git'
        sh 'git log --oneline -1'
      }
    }

    stage('Create .env from Credentials') {
      steps {
        echo '🔐 Creating .env file from Jenkins credentials...'
        withCredentials([string(credentialsId: 'api_env', variable: 'ENV_STRING')]) {
          sh '''
            # Parse the credential string and create .env file
            echo "$ENV_STRING" | tr ' ' '\\n' | grep '=' > .env
            
            # Verify .env file was created
            if [ -f .env ]; then
              echo "✅ .env file created successfully"
              echo "📋 Environment variables count: $(wc -l < .env)"
              echo "📋 Variables loaded:"
              cat .env | cut -d'=' -f1
            else
              echo "❌ Failed to create .env file!"
              exit 1
            fi
          '''
        }
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
          
          if [ ! -f ".env" ]; then
            echo "❌ .env file not found!"
            exit 1
          fi
        '''
      }
    }

    stage('Clean Old Resources') {
      steps {
        echo '🧹 Cleaning old containers and volumes...'
        sh '''
          set +e
          docker-compose -f $DOCKER_COMPOSE down -v
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
          docker-compose -f $DOCKER_COMPOSE up -d postgres

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
          # Get POSTGRES_DB from .env file
          POSTGRES_DB=$(grep "^postgres_db=" .env | cut -d'=' -f2)
          if [ -z "$POSTGRES_DB" ]; then
            POSTGRES_DB=$(grep "^POSTGRES_DB=" .env | cut -d'=' -f2)
          fi
          POSTGRES_DB=${POSTGRES_DB:-delivery}
          
          if [ -f "DB/init.sql" ]; then
            echo "📦 Importing DB/init.sql into database: $POSTGRES_DB"
            docker exec -i postgres psql -U postgres -d "$POSTGRES_DB" < DB/init.sql
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
          docker-compose -f $DOCKER_COMPOSE build --no-cache
          echo "✅ Build completed successfully"
        '''
      }
    }

    stage('Start All Services') {
      steps {
        echo '🚀 Starting API and pgAdmin...'
        sh '''
          docker-compose -f $DOCKER_COMPOSE up -d
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
          # Get PORT from .env file (try both lowercase and uppercase)
          PORT=$(grep "^port=" .env | cut -d'=' -f2)
          if [ -z "$PORT" ]; then
            PORT=$(grep "^PORT=" .env | cut -d'=' -f2)
          fi
          PORT=${PORT:-4000}
          
          echo "🔍 Checking API on port: $PORT"
          
          MAX_ATTEMPTS=20
          ATTEMPT=0

          while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
            if curl -s http://localhost:$PORT > /dev/null 2>&1; then
              echo "✅ API is responding on port $PORT!"
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
          # Get values from .env (try both cases)
          POSTGRES_DB=$(grep "^postgres_db=" .env | cut -d'=' -f2)
          if [ -z "$POSTGRES_DB" ]; then
            POSTGRES_DB=$(grep "^POSTGRES_DB=" .env | cut -d'=' -f2)
          fi
          POSTGRES_DB=${POSTGRES_DB:-delivery}
          
          PORT=$(grep "^port=" .env | cut -d'=' -f2)
          if [ -z "$PORT" ]; then
            PORT=$(grep "^PORT=" .env | cut -d'=' -f2)
          fi
          PORT=${PORT:-4000}
          
          echo "=== Container Status ==="
          docker ps --format "table {{.Names}}\t{{.State}}\t{{.Status}}"

          echo "=== PostgreSQL Health ==="
          docker exec postgres psql -U postgres -d "$POSTGRES_DB" -c "SELECT NOW();" || echo "Unable to connect"

          echo "=== API Health ==="
          curl -s -o /dev/null -w "Status: %{http_code}\\n" http://localhost:$PORT/ || echo "Not responding"
        '''
      }
    }

    stage('Verify Application') {
      steps {
        echo '✅ Verifying application deployment...'
        sh '''
          PORT=$(grep "^port=" .env | cut -d'=' -f2)
          if [ -z "$PORT" ]; then
            PORT=$(grep "^PORT=" .env | cut -d'=' -f2)
          fi
          PORT=${PORT:-4000}
          
          echo "API: http://localhost:$PORT"
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
      script {
        def port = sh(script: "grep '^port=' .env | cut -d'=' -f2 || grep '^PORT=' .env | cut -d'=' -f2 || echo '4000'", returnStdout: true).trim()
        echo "API is running at http://localhost:${port}"
        echo 'PgAdmin is available at http://localhost:8081'
      }
    }
    failure {
      echo '❌ Pipeline failed!'
      sh '''
        echo "=== Debug Information ==="
        docker ps -a
        echo "=== Last Docker Logs ==="
        docker-compose -f $DOCKER_COMPOSE logs --tail=100 || true
      '''
    }
    always {
      echo '🧹 Cleaning up sensitive files...'
      sh '''
        # Remove .env file for security
        rm -f .env
      '''
      echo '🧹 Pipeline finished'
    }
  }
}