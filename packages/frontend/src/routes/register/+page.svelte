<script lang="ts">
  import { goto } from "$app/navigation";
  import { superForm } from "sveltekit-superforms";
  import { register } from "$lib/client";
  import { setAuth } from "$lib/auth";
  import { registerFormSchema } from "$lib/forms";

  const { form, errors, submitting, validateForm } = superForm(
    { name: "", email: "", password: "" },
    {
      SPA: true,
      validators: registerFormSchema,
      validationMethod: "submit-only"
    }
  );

  let error = "";
  let pending = false;

  async function submit(): Promise<void> {
    error = "";
    pending = true;
    const validated = await validateForm({ update: true });
    if (!validated.valid) {
      error = "Check your details.";
      pending = false;
      return;
    }

    try {
      setAuth(await register(validated.data));
      await goto("/");
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "Registration failed.";
    } finally {
      pending = false;
    }
  }
</script>

<section class="page-head">
  <div>
    <p class="muted">Join the platform</p>
    <h1>Sign up.</h1>
  </div>
</section>

<form class="form" on:submit|preventDefault={submit}>
  <label>
    Name
    <input bind:value={$form.name} autocomplete="name" required minlength="2" />
    {#if $errors.name}
      <span class="error">{$errors.name[0]}</span>
    {/if}
  </label>
  <label>
    Email
    <input bind:value={$form.email} type="email" autocomplete="email" required />
    {#if $errors.email}
      <span class="error">{$errors.email[0]}</span>
    {/if}
  </label>
  <label>
    Password
    <input bind:value={$form.password} type="password" autocomplete="new-password" required minlength="8" />
    {#if $errors.password}
      <span class="error">{$errors.password[0]}</span>
    {/if}
  </label>
  {#if error}
    <p class="error">{error}</p>
  {/if}
  <button type="submit" disabled={pending || $submitting}>{pending ? "Creating account..." : "Create account"}</button>
</form>
