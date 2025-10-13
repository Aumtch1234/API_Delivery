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
          echo "🔍 Checking containers status..."
          docker ps -a | grep -E "delivery-api|postgres"
          
          echo ""
          echo "📋 Checking if delivery-api container is RUNNING..."
          if docker ps | grep -q "delivery-api"; then
            echo "✅ delivery-api container is RUNNING"
          else
            echo "❌ delivery-api container is NOT RUNNING"
            docker logs delivery-api
            exit 1
          fi
          
          echo ""
          echo "📋 Container logs (last 30 lines):"
          docker logs --tail=30 delivery-api
          
          echo ""
          echo "📋 Checking database connection..."
          docker exec delivery-api node -e "const pool = require('./config/db'); pool.query('SELECT NOW()', (err, res) => { if (err) { console.error('❌ DB Error:', err.message); process.exit(1); } else { console.log('✅ DB Connected:', res.rows[0].now); process.exit(0); } });"
          
          echo ""
          echo "✅ All checks passed!"
        '''
      }
    }

    stage('Verify Application') {
      steps {
        echo '✅ Verifying application deployment...'
        sh '''
          echo "📋 Running containers:"
          docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
          
          echo ""
          echo "📋 Application is deployed successfully!"
          echo "API: http://localhost:4000"
          echo "PgAdmin: http://localhost:8081"
          echo "Jenkins: http://localhost:8080"
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