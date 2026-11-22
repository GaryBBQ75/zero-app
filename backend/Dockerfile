# Base de données et comptes de zéro : PocketBase (un seul fichier, SQLite, API prête).
FROM alpine:3.20
ARG PB_VERSION=0.40.6
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -O /tmp/pb.zip \
 && unzip -q /tmp/pb.zip -d /pb && rm /tmp/pb.zip
COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks
COPY entrypoint.sh /pb/entrypoint.sh
RUN chmod +x /pb/entrypoint.sh
# Les données vivent ici : à monter en volume persistant dans Coolify
VOLUME /pb/pb_data
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8090/api/health || exit 1
ENTRYPOINT ["/pb/entrypoint.sh"]
