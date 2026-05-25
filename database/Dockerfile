FROM postgres:16

ENV POSTGRES_DB=captive_portal
ENV POSTGRES_USER=principal
ENV POSTGRES_PASSWORD=praga

COPY schema.sql /docker-entrypoint-initdb.d/schema.sql

EXPOSE 5432
