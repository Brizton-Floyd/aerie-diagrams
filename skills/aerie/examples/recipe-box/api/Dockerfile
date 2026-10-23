FROM python:3.13-slim
WORKDIR /app
COPY . .
RUN pip install .
EXPOSE 8000
CMD ["uvicorn", "recipes.main:app", "--host", "0.0.0.0", "--port", "8000"]
