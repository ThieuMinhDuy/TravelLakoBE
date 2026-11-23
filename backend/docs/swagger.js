import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Travel Plan API",
            version: "1.0.0",
            description: "API cho website du lịch"
        },
        servers: [
            {
                url: "/api",
                description: "Current Server"
            },
            {
                url: "http://localhost:5000/api",
                description: "Local Development Server"
            }
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "jwt"
                },
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            },
            schemas: {
                // Format chung của mọi response lỗi (errorHandler, rate limit)
                ErrorResponse: {
                    type: "object",
                    properties: {
                        message: { type: "string", description: "Thông báo hiển thị cho người dùng (có thể đổi câu chữ)" },
                        code: {
                            type: "string",
                            description: "Mã lỗi cố định để FE nhận diện (không đổi theo câu chữ). Không có với lỗi chưa phân loại. Danh sách đầy đủ: utils/httpError.js",
                            enum: [
                                "VALIDATION_ERROR", "DUPLICATE_KEY", "INVALID_JSON", "RATE_LIMITED", "MISSING_FIELDS",
                                "AUTH_REQUIRED", "TOKEN_INVALID", "USER_NOT_FOUND", "INVALID_CREDENTIALS",
                                "ACCOUNT_UNVERIFIED", "ACCOUNT_BLOCKED", "NOT_ADMIN", "EMAIL_EXISTS",
                                "OTP_INVALID", "OTP_EXPIRED", "OTP_ATTEMPTS_EXCEEDED", "OTP_COOLDOWN",
                                "CITY_EXISTS", "CITY_NOT_FOUND", "CITY_HAS_PLACES", "CITY_HAS_TRIPS"
                            ]
                        },
                        stack: { type: "string", nullable: true, description: "Chỉ có khi NODE_ENV=development" }
                    },
                    example: { message: "Tài khoản của bạn đã bị khóa!", code: "ACCOUNT_BLOCKED", stack: null }
                }
            }
        }
    },

    apis: [
        "./routes/*.js", 
        "./routes/**/*.js", 
        "./backend/routes/*.js", 
        "./backend/routes/**/*.js"
    ]
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;