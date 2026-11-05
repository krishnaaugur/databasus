from setuptools import find_packages, setup

setup(
    name="databasus-sdk",
    version="1.0.0",
    description="Official Python SDK for Databasus multi-tenant automated database backup and restore",
    author="Databasus",
    packages=find_packages(),
    python_requires=">=3.8",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)

