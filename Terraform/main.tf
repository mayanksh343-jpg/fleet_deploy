# -------------------------
# VPC
# -------------------------

resource "aws_vpc" "fleetflow_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}


# -------------------------
# Public Subnet
# -------------------------

resource "aws_subnet" "fleetflow_public_subnet" {
  vpc_id                  = aws_vpc.fleetflow_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet"
  }
}


# -------------------------
# Internet Gateway
# -------------------------

resource "aws_internet_gateway" "fleetflow_igw" {
  vpc_id = aws_vpc.fleetflow_vpc.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}


# -------------------------
# Route Table
# -------------------------

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


# -------------------------
# Route Table Association
# -------------------------

resource "aws_route_table_association" "fleetflow_public_assoc" {
  subnet_id      = aws_subnet.fleetflow_public_subnet.id
  route_table_id = aws_route_table.fleetflow_public_rt.id
}


# -------------------------
# Security Group
# -------------------------

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

  # Kubernetes NodePort range
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


# -------------------------
# EC2 Instance
# -------------------------

resource "aws_instance" "fleetflow_server" {
  ami                         = var.ami_id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.fleetflow_public_subnet.id
  vpc_security_group_ids      = [aws_security_group.fleetflow_sg.id]
  key_name                    = var.key_name
  associate_public_ip_address = true

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = {
    Name = "${var.project_name}-server"
  }
}


# -------------------------
# ECR - Frontend
# -------------------------

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


# -------------------------
# ECR - Backend
# -------------------------

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

resource "local_file" "ansible_inventory" {
  filename = "${path.module}/../Ansible/inventory.ini"

  content = <<-EOT
[servers]
fleetflow ansible_host=${aws_instance.fleetflow_server.public_ip} ansible_user=ec2-user ansible_ssh_private_key_file=C:/Users/mayan/OneDrive/Desktop/realdevopsproject/Fleet/Ansible/fleetflow-key.pem
EOT

  depends_on = [
    aws_instance.fleetflow_server
  ]
}