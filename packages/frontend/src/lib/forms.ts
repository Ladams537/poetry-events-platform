import { authLoginBodySchema, authRegisterBodySchema, eventCreateBodySchema } from "@poetry/shared";
import { zod4 } from "sveltekit-superforms/adapters";

export const loginFormSchema = zod4(authLoginBodySchema);
export const registerFormSchema = zod4(authRegisterBodySchema);
export const eventFormSchema = zod4(eventCreateBodySchema);
