output "vpc_id" {
  description = "FleetFlow VPC ID"
  value       = aws_vpc.fleetflow_vpc.id
}

output "subnet_id" {
  description = "FleetFlow public subnet ID"
  value       = aws_subnet.fleetflow_public_subnet.id
}

output "instance_id" {
  description = "FleetFlow EC2 instance ID"
  value       = aws_instance.fleetflow_server.id
}

output "public_ip" {
  description = "FleetFlow EC2 public IP"
  value       = aws_instance.fleetflow_server.public_ip
}

output "frontend_ecr_url" {
  description = "Frontend ECR repository"
  value       = aws_ecr_repository.frontend.repository_url
}

output "backend_ecr_url" {
  description = "Backend ECR repository"
  value       = aws_ecr_repository.backend.repository_url
}
