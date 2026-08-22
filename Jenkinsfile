pipeline {

    agent any

    environment {
        AWS_REGION = 'ap-south-1'
        AWS_ACCOUNT_ID = '068765434248'
        EKS_CLUSTER = 'fleet-cluster'

        ECR_REGISTRY = "068765434248.dkr.ecr.ap-south-1.amazonaws.com"

        BACKEND_REPO = "${ECR_REGISTRY}/fleetflow-backend"
        FRONTEND_REPO = "${ECR_REGISTRY}/fleetflow-frontend"

        IMAGE_TAG = "${BUILD_NUMBER}"

        HELM_RELEASE = 'fleetflow'
        HELM_CHART = './helm/fleet-helm'

        K8S_NAMESPACE = 'FleetFlow'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify Tools') {
            steps {
                sh '''
                    set -e

                    echo "Checking required tools..."

                    docker --version
                    aws --version
                    kubectl version --client
                    helm version
                    trivy --version

                    echo "All required tools are available."
                '''
            }
        }

        stage('Build Docker Images') {
            steps {
                sh '''
                    set -e

                    echo "Building FleetFlow backend image..."

                    docker build \
                        -t ${BACKEND_REPO}:${IMAGE_TAG} \
                        ./backend

                    echo "Building FleetFlow frontend image..."

                    docker build \
                        -t ${FRONTEND_REPO}:${IMAGE_TAG} \
                        ./Frontend
                '''
            }
        }

        stage('Security Scan') {
    steps {
        sh '''
            echo "Scanning backend: $BACKEND_REPO:$IMAGE_TAG"
            trivy image \
            --severity HIGH,CRITICAL \
            --exit-code 0 \
            $BACKEND_REPO:$IMAGE_TAG

            echo "Scanning frontend: $FRONTEND_REPO:$IMAGE_TAG"
            trivy image \
            --severity HIGH,CRITICAL \
            --exit-code 0 \
            $FRONTEND_REPO:$IMAGE_TAG
        '''
    }
}



        stage('Login to Amazon ECR') {
            steps {
                sh '''
                    set -e

                    echo "Logging into Amazon ECR..."

                    aws ecr get-login-password \
                        --region ${AWS_REGION} \
                    | docker login \
                        --username AWS \
                        --password-stdin ${ECR_REGISTRY}

                    echo "ECR login successful."
                '''
            }
        }

        stage('Push Images to ECR') {
            steps {
                sh '''
                    set -e

                    echo "Pushing backend image..."

                    docker push ${BACKEND_REPO}:${IMAGE_TAG}

                    echo "Pushing frontend image..."

                    docker push ${FRONTEND_REPO}:${IMAGE_TAG}

                    echo "Images pushed successfully."
                '''
            }
        }

        stage('Connect to EKS') {
            steps {
                sh '''
                    set -e

                    echo "Connecting kubectl to EKS..."

                    aws eks update-kubeconfig \
                        --region ${AWS_REGION} \
                        --name ${EKS_CLUSTER}

                    echo "Checking EKS nodes..."

                    kubectl get nodes

                    echo "EKS connection successful."
                '''
            }
        }

        stage('Deploy with Helm') {
            steps {
                sh '''
                    set -e

                    echo "Deploying FleetFlow using Helm..."

                    helm upgrade --install ${HELM_RELEASE} ${HELM_CHART} \
                        --namespace ${K8S_NAMESPACE} \
                        --create-namespace \
                        --set backend.image.repository=${BACKEND_REPO} \
                        --set backend.image.tag=${IMAGE_TAG} \
                        --set frontend.image.repository=${FRONTEND_REPO} \
                        --set frontend.image.tag=${IMAGE_TAG} \
                        --wait \
                        --timeout 5m

                    echo "Helm deployment completed."
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    set -e

                    echo "Checking pods..."

                    kubectl get pods \
                        -n ${K8S_NAMESPACE}

                    echo "Checking deployments..."

                    kubectl get deployments \
                        -n ${K8S_NAMESPACE}

                    echo "Checking services..."

                    kubectl get svc \
                        -n ${K8S_NAMESPACE}

                    echo "Checking Helm release..."

                    helm status ${HELM_RELEASE} \
                        --namespace ${K8S_NAMESPACE}

                    echo "Deployment verification completed."
                '''
            }
        }
    }

    post {

        success {
            echo '======================================'
            echo ' FLEETFLOW CI/CD PIPELINE SUCCESSFUL'
            echo '======================================'
            echo "Build: ${BUILD_NUMBER}"
            echo "Backend: ${BACKEND_REPO}:${IMAGE_TAG}"
            echo "Frontend: ${FRONTEND_REPO}:${IMAGE_TAG}"
            echo "EKS Cluster: ${EKS_CLUSTER}"
            echo "Helm Release: ${HELM_RELEASE}"
            echo "Namespace: ${K8S_NAMESPACE}"
        }

        failure {
            echo '======================================'
            echo ' FLEETFLOW CI/CD PIPELINE FAILED'
            echo '======================================'
            echo "Check the Jenkins console output."
        }

        always {
            sh '''
                echo "Cleaning unused Docker resources..."

                docker image prune -f || true
            '''

            cleanWs()
        }
    }
}
