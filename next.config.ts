import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * /waitlist IS RETIRED, operator ruling 2026-10-10: the firm is registered,
   * has an engineer of record, takes enquiries and quotes work, so a waitlist is
   * a statement that it is not open. `permanent: true` answers 308, which keeps
   * the method and the query string, so an old service page link carrying
   * ?service= still preselects the service on /contact. forms-audit asserts the
   * status, the location and the landing.
   */
  async redirects() {
    return [{ source: "/waitlist", destination: "/contact", permanent: true }];
  },
};

export default nextConfig;
