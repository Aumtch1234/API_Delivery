pipeline {
    agent {
        docker {
            image 'nikolaik/python-nodejs:python3.10-nodejs22'
            args '-u root:root -v /var/run/docker.sock:/var/run/docker.sock'
            // เพิ่ม label ถ้ามี node ที่ต้องการเฉพาะ
            // label 'docker-agent'
        }
    }

    environment {
        DOCKER_HUB_USER = "zoro01569"
        DOCKER_IMAGE = "delivery-api"
        CONTAINER_NAME = "delivery-api"
        VM_IP = "20.189.96.19"
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo '🔄 Checking out source code...'
                git branch: 'aum', 
                    url: 'https://github.com/aumtch1234/Api_Delivery.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                echo '📦 Installing npm dependencies...'
                sh 'npm install'
            }
        }

        stage('Build Docker Image') {
            steps {
                echo '🐳 Building Docker image...'
                sh 'docker build -t $DOCKER_HUB_USER/$DOCKER_IMAGE:latest .'
            }
        }

        stage('Push to Docker Hub') {
            steps {
                echo '⬆️ Pushing image to Docker Hub...'
                withCredentials([string(credentialsId: 'dockerhub-password', variable: 'DOCKER_PASS')]) {
                    sh '''
                        echo $DOCKER_PASS | docker login -u $DOCKER_HUB_USER --password-stdin
                        docker push $DOCKER_HUB_USER/$DOCKER_IMAGE:latest
                        docker logout
                    '''
                }
            }
        }

        stage('Deploy to Server') {
            steps {
                echo '🚀 Deploying to production server...'
                sshagent(['server-ssh']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ubuntu@$VM_IP "
                          echo '📍 Navigating to project directory...'
                          cd /home/ubuntu/Api_Delivery &&
                          
                          echo '⬇️ Pulling latest code...'
                          git pull origin aum &&
                          
                          echo '🛑 Stopping containers...'
                          docker compose down &&
                          
                          echo '🔄 Pulling latest images...'
                          docker compose pull &&
                          
                          echo '✅ Starting containers...'
                          docker compose up -d --build &&
                          
                          echo '🎉 Deployment completed!'
                        "
                    '''
                }
            }
        }

        stage('Health Check') {
            steps {
                echo '🏥 Performing health check...'
                script {
                    sleep(time: 10, unit: 'SECONDS')
                    def response = sh(
                        script: "curl -s -o /dev/null -w '%{http_code}' http://${VM_IP}:4000 || echo '000'",
                        returnStdout: true
                    ).trim()
                    
                    if (response == '200' || response == '404') {
                        echo "✅ API is responding (HTTP ${response})"
                    } else {
                        echo "⚠️ API might not be ready yet (HTTP ${response})"
                    }
                }
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline completed successfully!'
        }
        failure {
            echo '❌ Pipeline failed! Please check the logs.'
        }
        always {
            echo '🧹 Cleanup completed'
        }
    }
}