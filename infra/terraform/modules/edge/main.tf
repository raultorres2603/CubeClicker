# Edge module: internet-facing ALB with WebSocket passthrough for /ws,
# two target groups (frontend default, backend for /ws + /auth* + /healthz),
# and ALB-assertable health checks (path + matcher 200).
#
# WebSocket upgrade handling: the ALB listener is HTTP and target groups use the
# HTTP protocol (HTTP/1.1 by default), so Upgrade/Connection headers pass through
# end-to-end; no request policy strips them. Target-group connection_termination
# is left at its default (the backend owns the WS lifecycle and heartbeats every
# 30s; idle_timeout = 90 is strictly greater than 2x that heartbeat).

resource "aws_lb" "main" {
  name               = "${var.project}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  # Strictly greater than 2x the backend's 30s heartbeat (hub.test.ts:556).
  idle_timeout = 90

  tags = {
    Name        = "${var.project}-${var.environment}-alb"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Frontend target group (default route).
resource "aws_lb_target_group" "frontend" {
  name        = "${var.project}-${var.environment}-frontend-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name        = "${var.project}-${var.environment}-frontend-tg"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Backend target group (/ws, /auth*, /healthz).
resource "aws_lb_target_group" "backend" {
  name        = "${var.project}-${var.environment}-backend-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/healthz"
    port                = "traffic-port"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name        = "${var.project}-${var.environment}-backend-tg"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# HTTP listener: default forwards to the frontend target group.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Route /ws to the backend target group.
resource "aws_lb_listener_rule" "ws" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/ws"]
    }
  }
}

# Route /auth* to the backend target group.
resource "aws_lb_listener_rule" "auth" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/auth*"]
    }
  }
}

# Route /healthz to the backend target group.
resource "aws_lb_listener_rule" "healthz" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/healthz"]
    }
  }
}