export default function handler(req, res) {
  return res.status(200).json({ route: "health", deploy: Date.now(), git: "test" });
}
