pipeline {
    agent any
    environment {
        IMAGE_NAME = 'churniq'
        CONTAINER_NAME = 'churniq-app'
    }
    stages {
        stage('Clone') {
            steps {
                checkout scm
            }
        }
        stage('Deploy') {
            steps {
                // 'bat' is the secret to making this fast on Windows
                bat 'npm install'
                bat "docker build -t ${IMAGE_NAME}:latest ."
                
                // Fast cleanup
                bat "docker stop ${CONTAINER_NAME} || ver > nul"
                bat "docker rm ${CONTAINER_NAME} || ver > nul"
                
                // Direct run
                bat "docker run -d --name ${CONTAINER_NAME} -p 3000:3000 ${IMAGE_NAME}:latest"
            }
        }
    }
}
