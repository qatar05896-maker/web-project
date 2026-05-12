import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import chatsRouter from "./chats";
import messagesRouter from "./messages";
import voiceRouter from "./voice";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(chatsRouter);
router.use(messagesRouter);
router.use(voiceRouter);

export default router;
