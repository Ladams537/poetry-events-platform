<script lang="ts">
  import { goto } from "$app/navigation";
  import { superForm } from "sveltekit-superforms";
  import { login } from "$lib/client";
  import { setAuth } from "$lib/auth";
  import { loginFormSchema } from "$lib/forms";

  const { form, errors, submitting, validateForm } = superForm(
    { email: "", password: "" },
    {
      SPA: true,
      validators: loginFormSchema,
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
      setAuth(await login(validated.data));
      await goto("/");
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "Login failed.";
    } finally {
      pending = false;
    }
  }
</script>

<section class="page-head">
  <div>
    <p class="muted">Welcome back</p>
    <h1>Log in.</h1>
  </div>
</section>

<form class="form" on:submit|preventDefault={submit}>
  <label>
    Email
    <input bind:value={$form.email} type="email" autocomplete="email" required />
    {#if $errors.email}
      <span class="error">{$errors.email[0]}</span>
    {/if}
  </label>
  <label>
    Password
    <input bind:value={$form.password} type="password" autocomplete="current-password" required minlength="8" />
    {#if $errors.password}
      <span class="error">{$errors.password[0]}</span>
    {/if}
  </label>
  {#if error}
    <p class="error">{error}</p>
  {/if}
  <button type="submit" disabled={pending || $submitting}>{pending ? "Logging in..." : "Log in"}</button>
</form>
