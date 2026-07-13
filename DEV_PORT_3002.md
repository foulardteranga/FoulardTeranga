# Lancer le serveur sur le port 3002

## Option 1 : Via npm (commande directe)

```bash
npm run dev -- -p 3002
```

Accès : http://localhost:3002

## Option 2 : Via variable d'environnement

```bash
PORT=3002 npm run dev
```

## Option 3 : Configuration persistante dans `.claude/launch.json`

Ajoute ou modifie la configuration :

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "dev-3002",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev", "--", "-p", "3002"],
      "port": 3002
    }
  ]
}
```

Puis dans Claude Code :
```
/preview_start --name dev-3002
```

## Option 4 : Tunnel de développement (Vercel)

```bash
vercel dev --listen 3002
```

## Arrêter le serveur

### Option 1 : Ctrl+C dans le terminal

Dans le terminal où le serveur tourne :
```bash
Ctrl + C
```

### Option 2 : Tuer le processus par port

```bash
lsof -i :3002 | awk 'NR>1 {print $2}' | xargs kill -9
```

### Option 3 : Tuer tous les localhost (ports 3000-3005, 8000, 8080)

```bash
for port in 3000 3001 3002 3003 3004 3005 8000 8080; do 
  lsof -i :$port 2>/dev/null | awk 'NR>1 {print $2}' | xargs -r kill -9 2>/dev/null
done
```

## Dépannage

- **Port déjà utilisé** : `lsof -i :3002` → `kill -9 <PID>`
- **Cache** : `rm -rf .next` avant de relancer
- **Env mismatch** : Vérifier `.env.local` (priorité sur `.env`)
