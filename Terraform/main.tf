# =========================================================
# FleetFlow Infrastructure
# VPC + EC2 + ECR + EKS + Managed Node Group
# =========================================================


# =========================================================
# VPC
# =========================================================

resource "aws_vpc" "fleetflow_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}


# =========================================================
# PUBLIC SUBNET 1
# =========================================================

resource "aws_subnet" "fleetflow_public_subnet" {
  vpc_id                  = aws_vpc.fleetflow_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
  Name                     = "${var.project_name}-public-subnet-1"
  "kubernetes.io/role/elb" = "1"
  "kubernetes.io/cluster/${var.project_name}-cluster" = "shared"
}
}


# =========================================================
# PUBLIC SUBNET 2
# =========================================================

resource "aws_subnet" "fleetflow_public_subnet_2" {
  vpc_id                  = aws_vpc.fleetflow_vpc.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true

  tags = {
  Name                     = "${var.project_name}-public-subnet-2"
  "kubernetes.io/role/elb" = "1"
  "kubernetes.io/cluster/${var.project_name}-cluster" = "shared"
}
}


# =========================================================
# INTERNET GATEWAY
# =========================================================

resource "aws_internet_gateway" "fleetflow_igw" {
  vpc_id = aws_vpc.fleetflow_vpc.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}


# =========================================================
# PUBLIC ROUTE TABLE
# =========================================================

resource "aws_route_table" "fleetflow_public_rt" {
  vpc_id = aws_vpc.fleetflow_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.fleetflow_igw.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}


# =========================================================
# ROUTE TABLE ASSOCIATION - SUBNET 1
# =========================================================

resource "aws_route_table_association" "fleetflow_public_assoc" {
  subnet_id      = aws_subnet.fleetflow_public_subnet.id
  route_table_id = aws_route_table.fleetflow_public_rt.id
}


# =========================================================
# ROUTE TABLE ASSOCIATION - SUBNET 2
# =========================================================

resource "aws_route_table_association" "fleetflow_public_assoc_2" {
  subnet_id      = aws_subnet.fleetflow_public_subnet_2.id
  route_table_id = aws_route_table.fleetflow_public_rt.id
}


# =========================================================
# SECURITY GROUP
# =========================================================

resource "aws_security_group" "fleetflow_sg" {
  name        = "${var.project_name}-sg"
  description = "Security group for FleetFlow"
  vpc_id      = aws_vpc.fleetflow_vpc.id

  # SSH
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

    # Jenkins
  ingress {
    description = "Jenkins"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }


  # HTTP
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Backend
  ingress {
    description = "Backend"
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Kubernetes NodePort
  ingress {
    description = "Kubernetes NodePort"
    from_port   = 30000
    to_port     = 32767
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-sg"
  }
}


# =========================================================
# IAM ROLE FOR EXISTING FLEETFLOW EC2
# =========================================================

resource "aws_iam_role" "fleetflow_ec2_role" {
  name = "${var.project_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "ec2.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ec2-role"
  }
}


# =========================================================
# EC2 ROLE POLICY - ALLOW EKS DESCRIBE
# =========================================================

resource "aws_iam_role_policy" "fleetflow_ec2_eks_policy" {
  name = "${var.project_name}-ec2-eks-policy"
  role = aws_iam_role.fleetflow_ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "eks:DescribeCluster"
        ]

        Resource = "*"
      }
    ]
  })
}


# =========================================================
# EC2 INSTANCE PROFILE
# =========================================================

resource "aws_iam_instance_profile" "fleetflow_ec2_profile" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.fleetflow_ec2_role.name
}


# =========================================================
# EXISTING FLEETFLOW EC2 SERVER
# =========================================================

resource "aws_instance" "fleetflow_server" {
  ami                         = var.ami_id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.fleetflow_public_subnet.id
  vpc_security_group_ids      = [aws_security_group.fleetflow_sg.id]
  key_name                    = var.key_name
  associate_public_ip_address = true

  # Attach IAM role to EC2
  iam_instance_profile = aws_iam_instance_profile.fleetflow_ec2_profile.name

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = {
    Name        = "FleetFlow-${terraform.workspace}"
    Environment = terraform.workspace
  }
}


# =========================================================
# ECR - FRONTEND
# =========================================================

resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-frontend"
  }
}


# =========================================================
# ECR - BACKEND
# =========================================================

resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-backend"
  }
}


# =========================================================
# ANSIBLE INVENTORY
# =========================================================

resource "local_file" "ansible_inventory" {
  filename = "${path.module}/../Ansible/inventory.ini"

  content = <<-EOT
[servers]
fleetflow ansible_host=${aws_instance.fleetflow_server.public_ip} ansible_user=ubuntu ansible_ssh_private_key_file=/home/mayank/.ssh/shellscript.pem
EOT

  depends_on = [
    aws_instance.fleetflow_server
  ]
}


# =========================================================
# EKS CLUSTER IAM ROLE
# =========================================================

resource "aws_iam_role" "fleetflow_eks_role" {
  name = "${var.project_name}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "eks.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-eks-cluster-role"
  }
}


# =========================================================
# EKS CLUSTER IAM POLICY
# =========================================================

resource "aws_iam_role_policy_attachment" "fleetflow_eks_cluster_policy" {
  role       = aws_iam_role.fleetflow_eks_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}


# =========================================================
# EKS CLUSTER
# =========================================================

resource "aws_eks_cluster" "fleetflow" {
  name     = "${var.project_name}-cluster"
  role_arn = aws_iam_role.fleetflow_eks_role.arn

  access_config {
    authentication_mode = "API_AND_CONFIG_MAP"
  }

  vpc_config {
    subnet_ids = [
      aws_subnet.fleetflow_public_subnet.id,
      aws_subnet.fleetflow_public_subnet_2.id
    ]
  }

  depends_on = [
    aws_iam_role_policy_attachment.fleetflow_eks_cluster_policy
  ]

  tags = {
    Name        = "${var.project_name}-cluster"
    Environment = terraform.workspace
  }
}


# =========================================================
# EKS NODE IAM ROLE
# =========================================================

resource "aws_iam_role" "fleetflow_node_role" {
  name = "${var.project_name}-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "ec2.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-eks-node-role"
  }
}


# =========================================================
# EKS WORKER NODE POLICY
# =========================================================

resource "aws_iam_role_policy_attachment" "fleetflow_worker_node_policy" {
  role       = aws_iam_role.fleetflow_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}


# =========================================================
# EKS CNI POLICY
# =========================================================

resource "aws_iam_role_policy_attachment" "fleetflow_cni_policy" {
  role       = aws_iam_role.fleetflow_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}


# =========================================================
# ECR READ-ONLY POLICY FOR EKS NODES
# =========================================================

resource "aws_iam_role_policy_attachment" "fleetflow_ecr_policy" {
  role       = aws_iam_role.fleetflow_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPullOnly"
}


# =========================================================
# EKS MANAGED NODE GROUP
# =========================================================

resource "aws_eks_node_group" "fleetflow_nodes" {
  cluster_name    = aws_eks_cluster.fleetflow.name
  node_group_name = "${var.project_name}-workers"

  node_role_arn = aws_iam_role.fleetflow_node_role.arn

  subnet_ids = [
    aws_subnet.fleetflow_public_subnet.id,
    aws_subnet.fleetflow_public_subnet_2.id
  ]

  instance_types = ["t3.small"]

  capacity_type = "ON_DEMAND"

  scaling_config {
    desired_size = 2
    min_size     = 2
    max_size     = 4
  }

  update_config {
    max_unavailable = 1
  }

  depends_on = [
    aws_iam_role_policy_attachment.fleetflow_worker_node_policy,
    aws_iam_role_policy_attachment.fleetflow_cni_policy,
    aws_iam_role_policy_attachment.fleetflow_ecr_policy
  ]

  tags = {
    Name        = "${var.project_name}-worker"
    Environment = terraform.workspace
  }
}

# =========================================================
# EKS ACCESS ENTRY FOR FLEETFLOW EC2
# =========================================================

resource "aws_eks_access_entry" "fleetflow_ec2_access" {
  cluster_name  = aws_eks_cluster.fleetflow.name
  principal_arn = aws_iam_role.fleetflow_ec2_role.arn
  type          = "STANDARD"
}

# =========================================================
# EKS ADMIN POLICY FOR FLEETFLOW EC2
# =========================================================

resource "aws_eks_access_policy_association" "fleetflow_ec2_admin" {
  cluster_name  = aws_eks_cluster.fleetflow.name
  principal_arn = aws_iam_role.fleetflow_ec2_role.arn

  policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }

  depends_on = [
    aws_eks_access_entry.fleetflow_ec2_access
  ]
}



  resource "aws_iam_role_policy_attachment" "fleetflow_ec2_ecr_policy" {
  role       = aws_iam_role.fleetflow_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
}