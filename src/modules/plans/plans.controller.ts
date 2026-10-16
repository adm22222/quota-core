import type { RequestHandler } from 'express';
import { createPlanService } from './plans.service.ts';
import type {
  CreatePlanInput,
  UpdatePlanInput,
  ListPlansQueryInput,
  PlanIdParamInput,
} from './plans.schema.ts';

export type PlanService = ReturnType<typeof createPlanService>;

export const listPlansController = (
  planService: PlanService,
): RequestHandler<{}, unknown, never, ListPlansQueryInput> => {
  return async (req, res, next) => {
    try {
      const result = await planService.listPlans(req.account.id, req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
};

export const createPlanController = (
  planService: PlanService,
): RequestHandler<{}, unknown, CreatePlanInput> => {
  return async (req, res, next) => {
    try {
      const plan = await planService.createPlan(req.account.id, req.body);
      res.status(201).json(plan);
    } catch (error) {
      next(error);
    }
  };
};

export const getPlanController = (
  planService: PlanService,
): RequestHandler<PlanIdParamInput> => {
  return async (req, res, next) => {
    try {
      const plan = await planService.getPlan(req.account.id, req.params.planId);
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };
};

export const updatePlanController = (
  planService: PlanService,
): RequestHandler<PlanIdParamInput, unknown, UpdatePlanInput> => {
  return async (req, res, next) => {
    try {
      const plan = await planService.updatePlan(
        req.account.id,
        req.params.planId,
        req.body,
      );
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };
};
