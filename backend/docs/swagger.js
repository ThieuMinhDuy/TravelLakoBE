import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { ERROR_CODES } from '../utils/httpError.js';

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
                            description: "Mã lỗi cố định để FE nhận diện (không đổi theo câu chữ). Mọi lỗi đều có mã; lỗi không lường trước là INTERNAL_ERROR. Ý nghĩa từng mã: utils/httpError.js",
                            enum: Object.values(ERROR_CODES)
                        },
                        retryAfter: {
                            type: "integer",
                            description: "Chỉ có với OTP_COOLDOWN, RATE_LIMITED (429) và OSM_UNAVAILABLE (503): số giây nên đợi trước khi thử lại"
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