pipeline {
    agent any

    environment {
        IMAGE_NAME = 'churniq'
        CONTAINER_NAME = 'churniq-app'
    }

    stages {
        stage('Clone') {
            steps {
                // This replaces 'Checkout' and matches your goal screenshot
                git branch: 'main', url: 'https://github.com/mitratobi/Capstone.git'
            }
        }

        stage('Deploy') {
            steps {
                // We use 'bat' for Windows!
                bat 'npm install'
                bat "docker build -t ${IMAGE_NAME}:latest ."
                
                // Clean up old containers so the new one can start
                bat "docker stop ${CONTAINER_NAME} || ver > nul"
                bat "docker rm ${CONTAINER_NAME} || ver > nul"
                
                // Start the app
                bat "docker run -d --name ${CONTAINER_NAME} -p 3000:3000 ${IMAGE_NAME}:latest"
            }
        }
    }
}
