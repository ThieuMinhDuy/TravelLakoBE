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