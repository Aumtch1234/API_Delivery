pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = "zoro01569"        // 👈 ชื่อผู้ใช้ Docker Hub
        DOCKER_IMAGE = "delivery-api"                      // 👈 ชื่อ image ที่จะสร้าง
        CONTAINER_NAME = "delivery-api"                    // 👈 ชื่อ container ตอน deploy
        VM_IP = "20.189.96.19"                             // 👈 IP จริงของ VM
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'aum', url: 'https://github.com/aumtch1234/Api_Delivery.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t $DOCKER_HUB_USER/$DOCKER_IMAGE:latest .'
            }
        }

        stage('Push Docker Image') {
            steps {
                withCredentials([string(credentialsId: 'dockerhub-password', variable: 'DOCKER_PASS')]) {
                    sh '''
                        echo $DOCKER_PASS | docker login -u $DOCKER_HUB_USER --password-stdin
                        docker push $DOCKER_HUB_USER/$DOCKER_IMAGE:latest
                    '''
                }
            }
        }

        stage('Deploy to Server') {
            steps {
                sshagent(['server-ssh']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ubuntu@$VM_IP "
                            docker pull $DOCKER_HUB_USER/$DOCKER_IMAGE:latest &&
                            docker stop $CONTAINER_NAME || true &&
                            docker rm $CONTAINER_NAME || true &&
                            docker run -d -p 4000:4000 --name $CONTAINER_NAME \
                                -e NODE_ENV=production \
                                -e DB_HOST=postgres \
                                -e DB_USER=postgres \
                                -e DB_PASSWORD=1234 \
                                -e DB_NAME=delivery \
                                -e DB_PORT=5432 \
                                $DOCKER_HUB_USER/$DOCKER_IMAGE:latest
                        "
                    '''
                }
            }
        }
    }
}