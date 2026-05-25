FROM postgres:16

ENV POSTGRES_DB=captive_portal_db
ENV POSTGRES_USER=utente_captive
ENV POSTGRES_PASSWORD=password_segreta_123

COPY schema.sql /docker-entrypoint-initdb.d/schema.sql

EXPOSE 5432
