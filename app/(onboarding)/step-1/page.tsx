"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { getSessionToken, setSessionToken, setBrandName, setBrandUrl } from "@/lib/session";
import { useToast } from "@/components/ui/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StepIndicator from "@/components/features/onboarding/StepIndicator";

// ─── Schéma Zod ───────────────────────────────────────────────────────────────

const step1Schema = z.object({
  account_type: z.enum(["brand", "agency"]).default("brand"),
  brand_url: z
    .string()
    .min(1, "URL requise")
    .transform((val) => (val.startsWith("http") ? val : `https://${val}`)),
  brand_name: z.string().min(2, "Minimum 2 caractères"),
  brand_country: z.string().default("France"),
});

// z.input = types avant transforms/defaults (ce que le formulaire manipule)
// z.infer  = types après (ce que onSubmit reçoit)
type Step1Input = z.input<typeof step1Schema>;
type Step1Data = z.infer<typeof step1Schema>;

// ─── Données statiques ────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  {
    value: "brand" as const,
    label: "Marque",
    description: "Une marque, un dashboard",
  },
  {
    value: "agency" as const,
    label: "Agence",
    description: "Multi-marques & clients",
  },
];

const COUNTRIES = [
  { value: "France", flag: "🇫🇷" },
  { value: "Belgique", flag: "🇧🇪" },
  { value: "Suisse", flag: "🇨🇭" },
  { value: "Canada", flag: "🇨🇦" },
  { value: "Luxembourg", flag: "🇱🇺" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Step1Page() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step1Input, unknown, Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      account_type: "brand",
      brand_country: "France",
    },
  });

  const selectedAccountType = watch("account_type");

  const onSubmit = async (data: Step1Data) => {
    setIsSubmitting(true);
    try {
      const existingToken = getSessionToken();

      if (existingToken) {
        // Session existante → PATCH
        const res = await fetch("/api/onboarding/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_token: existingToken,
            current_step: 1,
            brand_name: data.brand_name,
            brand_url: data.brand_url,
            brand_country: data.brand_country,
            account_type: data.account_type,
          }),
        });
        if (!res.ok) throw new Error("Erreur mise à jour session");
      } else {
        // Nouvelle session → POST
        const res = await fetch("/api/onboarding/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand_name: data.brand_name,
            brand_url: data.brand_url,
            brand_country: data.brand_country,
            account_type: data.account_type,
          }),
        });
        if (!res.ok) throw new Error("Erreur création session");
        const json = (await res.json()) as { data: { session_token: string } };
        setSessionToken(json.data.session_token);
      }

      setBrandName(data.brand_name);
      setBrandUrl(data.brand_url);
      router.push("/step-2");
    } catch (err) {
      toast({
        title: "Une erreur est survenue",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de continuer. Réessaie.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full px-12 py-10">
      {/* 1. Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex w-9 h-9 items-center justify-center rounded-lg bg-[#6B54FA] shrink-0">
          <span className="text-white text-sm font-bold font-[family-name:var(--font-sora)]">
            V
          </span>
        </div>
        <span className="text-sm font-semibold text-[#141420] font-[family-name:var(--font-sora)]">
          LLM Visibility
        </span>
      </div>

      <div className="mt-8">
        <StepIndicator currentStep={1} />
      </div>

      {/* 2. Titre */}
      <div className="mt-8">
        <h1 className="text-2xl font-bold text-[#141420] font-[family-name:var(--font-sora)]">
          Configurez votre marque
        </h1>
        <p className="text-sm text-[#707085] mt-1 font-[family-name:var(--font-dm-sans)]">
          Quelques informations pour personnaliser votre audit de visibilité IA.
        </p>
      </div>

      {/* 3. Sélecteur type de compte */}
      <div className="mt-6">
        <p className="text-[13px] font-medium text-[#141420] mb-2">
          Type de compte
        </p>
        <div className="grid grid-cols-2 gap-3">
          {ACCOUNT_TYPES.map((type) => {
            const isSelected = selectedAccountType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setValue("account_type", type.value)}
                className={`relative cursor-pointer rounded-xl p-4 text-left transition-all ${
                  isSelected
                    ? "bg-[#E5DEFF] border-2 border-[#6B54FA]"
                    : "bg-white border border-[#E0E0EB]"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#6B54FA] flex items-center justify-center">
                    <svg
                      width="10"
                      height="8"
                      viewBox="0 0 10 8"
                      fill="none"
                      className="text-white"
                    >
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
                <div className="w-8 h-8 rounded-lg bg-[#F3F4F6]" />
                <p className="text-sm font-semibold text-[#141420] mt-2">
                  {type.label}
                </p>
                <p className="text-xs text-[#707085]">{type.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Formulaire */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-6 flex flex-col gap-4"
      >
        {/* Site web */}
        <div>
          <label
            htmlFor="brand_url"
            className="block text-[13px] font-medium text-[#141420] mb-1.5"
          >
            Site web
          </label>
          <div className="relative">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            >
              <circle cx="8" cy="8" r="6.5" stroke="#707085" />
              <path
                d="M8 1.5C8 1.5 6 4.5 6 8C6 11.5 8 14.5 8 14.5"
                stroke="#707085"
                strokeLinecap="round"
              />
              <path
                d="M8 1.5C8 1.5 10 4.5 10 8C10 11.5 8 14.5 8 14.5"
                stroke="#707085"
                strokeLinecap="round"
              />
              <path d="M1.5 8H14.5" stroke="#707085" strokeLinecap="round" />
              <path d="M2 5.5H14" stroke="#707085" strokeLinecap="round" />
              <path d="M2 10.5H14" stroke="#707085" strokeLinecap="round" />
            </svg>
            <Input
              id="brand_url"
              type="text"
              placeholder="monsite.com"
              {...register("brand_url")}
              className="pl-9 h-12 rounded-xl border-[#E0E0EB] bg-white text-sm text-[#141420] placeholder:text-[#B0B0C3] focus:border-[#6B54FA] focus-visible:ring-0 focus-visible:border-[#6B54FA]"
            />
          </div>
          {errors.brand_url && (
            <p className="text-red-500 text-xs mt-1">
              {errors.brand_url.message}
            </p>
          )}
        </div>

        {/* Nom de la marque */}
        <div>
          <label
            htmlFor="brand_name"
            className="block text-[13px] font-medium text-[#141420] mb-1.5"
          >
            Nom de la marque
          </label>
          <Input
            id="brand_name"
            type="text"
            placeholder="Ma Marque"
            {...register("brand_name")}
            className="h-12 rounded-xl border-[#E0E0EB] bg-white text-sm text-[#141420] placeholder:text-[#B0B0C3] focus:border-[#6B54FA] focus-visible:ring-0 focus-visible:border-[#6B54FA]"
          />
          {errors.brand_name && (
            <p className="text-red-500 text-xs mt-1">
              {errors.brand_name.message}
            </p>
          )}
        </div>

        {/* Pays principal */}
        <div>
          <label
            htmlFor="brand_country"
            className="block text-[13px] font-medium text-[#141420] mb-1.5"
          >
            Pays principal
          </label>
          <select
            id="brand_country"
            {...register("brand_country")}
            className="w-full h-12 rounded-xl border border-[#E0E0EB] bg-white px-4 text-sm text-[#141420] focus:outline-none focus:border-[#6B54FA]"
          >
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.flag} {c.value}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Bouton submit */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-8 w-full h-13 bg-[#6B54FA] hover:bg-[#5A43E8] text-white font-semibold rounded-xl text-[15px]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
              Chargement...
            </span>
          ) : (
            "Continuer →"
          )}
        </Button>
      </form>
    </div>
  );
}
