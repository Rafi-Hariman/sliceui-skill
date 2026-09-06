// pilar-loader — lazy loader for the org-private pilar feature.
//
// The pilar catalogs (pilar-catalog.mjs, pilar-showcase.mjs) and their consumers
// (uii-profile.mjs, uii-slice-policy.mjs, pilar-version.mjs) embed the org's PRIVATE pilar
// source. In the PUBLIC npm tarball those files are excluded (see package.json `files`), so a
// non-UII user must never load them — yet a UII/internal build (where the files ARE present)
// must keep the full feature byte-identical to before.
//
// loadPilar() returns the pilar data whenever the modules are importable (repo / internal
// build), and `null` when they are absent (public tarball). It is NOT gated on `profile` —
// presence of the files is the only signal, so the feature degrades gracefully instead of
// crashing, and never leaks private source into the public path.

export async function loadPilar() {
  try {
    const [catalog, policy, profile, version] = await Promise.all([
      import("../framework/angular/pilar-catalog.mjs"),
      import("../framework/angular/uii-slice-policy.mjs"),
      import("../framework/angular/uii-profile.mjs"),
      import("./pilar-version.mjs"),
    ]);
    return {
      pilarComponents: catalog.PILAR_COMPONENTS,
      pilarVersion: catalog.PILAR_VERSION,
      legalTableInputs: policy.SLICE_TABLE_INPUTS,
      legalTableOutputs: policy.SLICE_TABLE_OUTPUTS,
      forbiddenTableInputs: policy.SLICE_FORBIDDEN_TABLE_INPUTS,
      forbiddenTableOutputs: policy.SLICE_FORBIDDEN_TABLE_OUTPUTS,
      authKeyByAction: profile.UII_AUTHKEY_BY_ACTION,
      registryEntries: profile.UII_REGISTRY_ENTRIES,
      renderUiiProfileMd: profile.renderUiiProfileMd,
      renderPilarReferenceMd: profile.renderPilarReferenceMd,
      renderPilarShowcaseMd: profile.renderPilarShowcaseMd,
      pilarVersionStatus: version.pilarVersionStatus,
      pilarDoctorCheck: version.pilarDoctorCheck,
    };
  } catch {
    return null; // pilar stripped from this install → generic mode
  }
}
