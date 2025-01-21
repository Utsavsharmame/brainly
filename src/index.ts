import express from "express";
import { random } from "./utils";
import jwt from "jsonwebtoken";
import { ContentModel, LinkModel, UserModel } from "./db";
import { JWT_PASSWORD } from "./config";
import { userMiddleware } from "./middleware";
import cors from "cors";

const app = express();

// Middleware setup
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173', // Vite's default port
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

app.post("/api/v1/signup", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: "Username and password are required"
        });
    }

    try {
        await UserModel.create({
            username,
            password // TODO: Hash password before storing
        });

        res.status(201).json({
            message: "User created successfully"
        });
    } catch(e) {
        res.status(409).json({
            message: "User already exists"
        });
    }
});

app.post("/api/v1/signin", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: "Username and password are required"
        });
    }

    try {
        const existingUser = await UserModel.findOne({
            username,
            password
        });

        if (!existingUser) {
            return res.status(401).json({
                message: "Invalid credentials"
            });
        }

        const token = jwt.sign({
            id: existingUser._id
        }, JWT_PASSWORD);

        res.json({
            message: "Signed in successfully",
            token
        });
    } catch(e) {
        res.status(500).json({
            message: "Error during signin"
        });
    }
});

app.post("/api/v1/content", userMiddleware, async (req, res) => {
    const { link, type, title } = req.body;

    if (!link || !type || !title) {
        return res.status(400).json({
            message: "Link, type, and title are required"
        });
    }

    try {
        await ContentModel.create({
            link,
            type,
            title,
            userId: req.userId,
            tags: []
        });

        res.json({
            message: "Content added"
        });
    } catch(e) {
        res.status(500).json({
            message: "Error during content creation"
        });
    }
});

app.get("/api/v1/content", userMiddleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;

    try {
        const content = await ContentModel.find({
            userId: userId
        }).populate("userId", "username");

        res.json({
            content
        });
    } catch(e) {
        res.status(500).json({
            message: "Error during content retrieval"
        });
    }
});

app.delete("/api/v1/content", userMiddleware, async (req, res) => {
    const { contentId } = req.body;

    if (!contentId) {
        return res.status(400).json({
            message: "Content ID is required"
        });
    }

    try {
        await ContentModel.deleteMany({
            _id: contentId,
            userId: req.userId
        });

        res.json({
            message: "Deleted"
        });
    } catch(e) {
        res.status(500).json({
            message: "Error during content deletion"
        });
    }
});

app.post("/api/v1/brain/share", userMiddleware, async (req, res) => {
    const { share } = req.body;

    if (share) {
        try {
            const existingLink = await LinkModel.findOne({
                userId: req.userId
            });

            if (existingLink) {
                res.json({
                    hash: existingLink.hash
                });
                return;
            }

            const hash = random(10);
            await LinkModel.create({
                userId: req.userId,
                hash: hash
            });

            res.json({
                hash
            });
        } catch(e) {
            res.status(500).json({
                message: "Error during link creation"
            });
        }
    } else {
        try {
            await LinkModel.deleteOne({
                userId: req.userId
            });

            res.json({
                message: "Removed link"
            });
        } catch(e) {
            res.status(500).json({
                message: "Error during link deletion"
            });
        }
    }
});

app.get("/api/v1/brain/:shareLink", async (req, res) => {
    const { shareLink } = req.params;

    try {
        const link = await LinkModel.findOne({
            hash: shareLink
        });

        if (!link) {
            res.status(404).json({
                message: "Link not found"
            });
            return;
        }

        const content = await ContentModel.find({
            userId: link.userId
        });

        const user = await UserModel.findOne({
            _id: link.userId
        });

        if (!user) {
            res.status(404).json({
                message: "User not found"
            });
            return;
        }

        res.json({
            username: user.username,
            content: content
        });
    } catch(e) {
        res.status(500).json({
            message: "Error during link retrieval"
        });
    }
});

app.listen(3000);