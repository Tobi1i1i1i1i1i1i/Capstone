pipeline {
    agent any

    environment {
        IMAGE_NAME     = 'churniq'
        CONTAINER_NAME = 'churniq-app'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/ChurnIQ/Capstone.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Test') {
            steps {
                sh '''
                    # Try to start Flask ML API if Python venv is available
                    if [ -f ml/app.py ]; then
                        python3 -m venv /tmp/ci-mlenv 2>/dev/null || true
                        /tmp/ci-mlenv/bin/pip install -q -r ml/requirements.txt 2>/dev/null || true
                        ML_API_URL=http://localhost:5000 \
                        MODEL_PATH=ml/model.pkl \
                        SCALER_PATH=ml/scaler.pkl \
                        /tmp/ci-mlenv/bin/python ml/app.py &
                        sleep 4
                        echo "Flask startup attempted"
                    fi
                    npm test
                '''
            }
            post {
                always {
                    sh 'pkill -f "ml/app.py" || true'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build --network=host -t ${IMAGE_NAME}:${BUILD_NUMBER} .'
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
            sh 'echo "Pipeline succeeded. ChurnIQ is live at http://$(hostname -I | awk \'{print $1}\'):3000"'
        }
        failure {
            echo 'Pipeline failed. Check logs above.'
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
}
