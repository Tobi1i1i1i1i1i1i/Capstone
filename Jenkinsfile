pipeline {
<<<<<<< HEAD
    agent any

    environment {
        IMAGE_NAME = 'churniq'
        CONTAINER_NAME = 'churniq-app'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/mitratobi/Capstone.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} .'
                sh 'docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${IMAGE_NAME}:latest'
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    docker compose down --remove-orphans || true
                    docker compose up -d
                '''
            }
        }
    }

    post {
        success {
            sh "echo 'Pipeline succeeded. ChurnIQ is live at http://'$(hostname -I | awk '{print $1}')':3000'"
        }
        failure {
            echo 'Pipeline failed. Check logs above.'
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
=======
    agent any
    environment {
        IMAGE_NAME = 'churniq'
        CONTAINER_NAME = 'churniq-app'
    }
    stages {
        stage('Clone') { 
            steps {
                // Groups everything related to getting the code
                git branch: 'main', url: 'https://github.com/mitratobi/Capstone.git'
            }
        }
        stage('Deploy') {
            steps {
                // Groups all the work into the second column
                bat 'npm install'
                bat "docker build -t ${IMAGE_NAME}:%BUILD_NUMBER% ."
                bat "docker stop ${CONTAINER_NAME} || ver > nul"
                bat "docker rm ${CONTAINER_NAME} || ver > nul"
                bat "docker run -d --name ${CONTAINER_NAME} -p 3000:3000 ${IMAGE_NAME}:%BUILD_NUMBER%"
            }
        }
    }

}
