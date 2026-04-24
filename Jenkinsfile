pipeline {
    agent any

    environment {
        BACKEND_IMAGE  = 'churniq-backend'
        ML_IMAGE       = 'churniq-ml'
        FRONTEND_IMAGE = 'churniq-frontend'
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

        stage('Build Docker Images') {
            parallel {
                stage('Backend') {
                    steps {
                        sh 'docker build --network=host -t ${BACKEND_IMAGE}:${BUILD_NUMBER} -t ${BACKEND_IMAGE}:latest .'
                    }
                }
                stage('ML Service') {
                    steps {
                        sh 'docker build --network=host -t ${ML_IMAGE}:${BUILD_NUMBER} -t ${ML_IMAGE}:latest ./ml'
                    }
                }
                stage('Frontend') {
                    steps {
                        sh 'docker build --network=host -t ${FRONTEND_IMAGE}:${BUILD_NUMBER} -t ${FRONTEND_IMAGE}:latest ./client'
                    }
                }
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    # Locate .env from standard locations (works on any machine)
                    if [ ! -f .env ]; then
                        for candidate in \
                            /etc/churniq/.env \
                            "$HOME/.churniq/.env" \
                            /var/jenkins_home/churniq.env \
                            "$HOME/churniq.env"; do
                            if [ -f "$candidate" ]; then
                                echo "Using .env from $candidate"
                                cp "$candidate" .env
                                break
                            fi
                        done
                    fi

                    if [ ! -f .env ]; then
                        echo "ERROR: No .env file found. Place your .env at /etc/churniq/.env or $HOME/.churniq/.env on this machine."
                        exit 1
                    fi

                    # Release ports 3000, 5000 held by any existing containers
                    docker ps --format "{{.ID}} {{.Ports}}" | grep -E "0.0.0.0:(3000|5000)" | awk "{print \$1}" | xargs -r docker stop || true

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
