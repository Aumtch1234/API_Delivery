pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = "zoro01569"
        DOCKER_IMAGE = "delivery-api"
        CONTAINER_NAME = "delivery-api"
        VM_IP = "20.189.96.19"
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
                          cd /home/ubuntu/Api_Delivery &&
                          git pull origin aum &&
                          docker compose down &&
                          docker compose pull &&
                          docker compose up -d --build
                        "
                    '''
                }
            }
        }
    }
}
