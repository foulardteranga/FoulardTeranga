import { z } from "zod";

export const orderEditSchema = z.object({
  clientName: z.string().trim().min(2, "Merci d'indiquer le nom."),
  place: z.string().trim().min(2, "Indiquez où livrer."),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{6,20}$/, "Un numéro pour la joindre."),
});

export type OrderEditInput = z.infer<typeof orderEditSchema>;
