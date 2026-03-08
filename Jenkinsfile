pipeline {
    agent any
    environment {
        IMAGE_NAME = 'churniq'
        CONTAINER_NAME = 'churniq-app'
    }
    stages {
        stage('Clone') { 
            steps {
                // This will create the first green column
                checkout scm
            }
        }
        stage('Deploy') {
            steps {
                // We use 'bat' because your Jenkins is on Windows Localhost
                bat 'npm install'
                bat "docker build -t ${IMAGE_NAME}:latest ."
                
                // This cleans up any old version of the app so the new one can start
                bat "docker stop ${CONTAINER_NAME} || ver > nul"
                bat "docker rm ${CONTAINER_NAME} || ver > nul"
                
                // This starts your app on port 3000
                bat "docker run -d --name ${CONTAINER_NAME} -p 3000:3000 ${IMAGE_NAME}:latest"
            }
        }
    }
}
