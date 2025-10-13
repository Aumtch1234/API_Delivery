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
          
          # Remove obsolete version attribute from docker-compose.yml
          if grep -q "^version:" "$DOCKER_COMPOSE"; then
            echo "🔧 Removing obsolete version attribute..."
            sed -i '/^version:/d' "$DOCKER_COMPOSE"
          fi
        '''
      }
    }

    stage('Clean Old Resources') {
      steps {
        echo '🧹 Cleaning old containers and volumes...'
        sh '''
          set +e
          
          # Stop and remove all containers from docker-compose
          docker-compose -f $DOCKER_COMPOSE down -v
          
          # Force remove specific containers if they still exist
          docker rm -f postgres delivery-api pgadmin api-delivery 2>/dev/null || true
          
          # Clean up unused resources
          docker image prune -f
          docker volume prune -f
          docker network prune -f
          
          set -e
          
          echo "✅ Cleanup completed"
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
            echo "⚠️  No DB/init.sql found"
            echo "⚠️  Make sure your API handles database migrations automatically"
            echo "⚠️  Or create DB/init.sql with your database schema"
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
          echo "📋 Starting all services with docker-compose..."
          docker-compose -f $DOCKER_COMPOSE up -d
          
          echo ""
          echo "⏳ Waiting for services to initialize..."
          sleep 5
          
          echo ""
          echo "📋 Container status:"
          docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
          
          echo ""
          echo "📋 Checking for any failed containers..."
          FAILED=$(docker ps -a --filter "status=exited" --format "{{.Names}}" | grep -E "delivery-api|postgres|pgadmin" || true)
          
          if [ ! -z "$FAILED" ]; then
            echo "❌ Some containers failed to start: $FAILED"
            echo ""
            for container in $FAILED; do
              echo "📋 Logs for $container:"
              docker logs $container
              echo ""
            done
            exit 1
          fi
          
          echo "✅ All services started successfully"
        '''
      }
    }

    stage('Wait for API to Start') {
      steps {
        echo '⏳ Waiting for API to be ready...'
        sh '''
          # Get PORT from .env file
          PORT=$(grep "^port=" .env | cut -d'=' -f2)
          if [ -z "$PORT" ]; then
            PORT=$(grep "^PORT=" .env | cut -d'=' -f2)
          fi
          PORT=${PORT:-4000}
          
          echo "🔍 Checking all containers status..."
          docker ps -a
          
          echo ""
          echo "📋 Checking if delivery-api container exists..."
          if docker ps -a | grep -q "delivery-api"; then
            echo "✅ delivery-api container exists"
            
            # Check if it's running
            if docker ps | grep -q "delivery-api"; then
              echo "✅ delivery-api container is RUNNING"
            else
              echo "❌ delivery-api container EXISTS but NOT RUNNING"
              echo ""
              echo "📋 Container exit code and status:"
              docker ps -a --filter "name=delivery-api" --format "table {{.Names}}\t{{.Status}}"
              echo ""
              echo "📋 Full container logs:"
              docker logs delivery-api
              exit 1
            fi
          else
            echo "❌ delivery-api container DOES NOT EXIST"
            echo ""
            echo "📋 All containers:"
            docker ps -a
            echo ""
            echo "📋 Docker compose logs:"
            docker-compose -f $DOCKER_COMPOSE logs --tail=100
            exit 1
          fi
          
          echo ""
          echo "📋 Container logs (last 50 lines):"
          docker logs --tail=50 delivery-api
          
          echo ""
          echo "🔍 Waiting for API on port: $PORT"
          
          MAX_ATTEMPTS=20
          ATTEMPT=0
          
          while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
            # ✅ FIX: Use docker exec to test from inside container network
            HTTP_CODE=$(docker exec delivery-api curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/health 2>/dev/null || echo "000")
            
            if [ "$HTTP_CODE" = "200" ]; then
              echo "✅ API health check passed! (HTTP $HTTP_CODE)"
              
              # Show health check response
              echo "📋 Health check response:"
              docker exec delivery-api curl -s http://localhost:$PORT/health | head -n 20
              break
            elif [ "$HTTP_CODE" = "503" ]; then
              echo "⚠️  API responding but database not ready (HTTP $HTTP_CODE)"
            elif [ "$HTTP_CODE" != "000" ]; then
              echo "⚠️  API responding with HTTP $HTTP_CODE"
            fi
            
            ATTEMPT=$((ATTEMPT + 1))
            echo "⏳ Waiting for API... ($ATTEMPT/$MAX_ATTEMPTS)"
            sleep 3
          done
          
          if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
            echo "❌ API health check failed after $MAX_ATTEMPTS attempts"
            echo ""
            echo "📋 Final container logs:"
            docker logs delivery-api
            echo ""
            echo "📋 Checking database connection from API container:"
            docker exec delivery-api node -e "
              const pool = require('./config/db');
              pool.query('SELECT NOW()', (err, res) => {
                if (err) console.error('❌ DB Connection Error:', err.message);
                else console.log('✅ DB Connected:', res.rows[0].now);
                process.exit(err ? 1 : 0);
              });
            " || echo "Database connection check failed"
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

          echo ""
          echo "=== PostgreSQL Health ==="
          docker exec postgres psql -U postgres -d "$POSTGRES_DB" -c "SELECT NOW();" || echo "Unable to connect"

          echo ""
          echo "=== API Health (from inside container) ==="
          docker exec delivery-api curl -s http://localhost:$PORT/health | head -n 10 || echo "Not responding"
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
          docker logs --tail=20 delivery-api 2>&1 || docker logs --tail=20 api-delivery 2>&1 || echo "Container not found"
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