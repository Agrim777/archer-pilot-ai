import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import aiRouter from "./ai";
import archerConnectionsRouter from "./archerConnections";
import deploymentsRouter from "./deployments";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(aiRouter);
router.use(archerConnectionsRouter);
router.use(deploymentsRouter);
router.use(dashboardRouter);
router.use(adminRouter);

export default router;
