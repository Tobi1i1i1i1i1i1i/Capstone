"""
train.py — Train a Random Forest churn classifier on churn_dataset.csv
and serialize the model + scaler as model.pkl / scaler.pkl.

Usage:
    python train.py                          # uses default paths
    python train.py --data ../churn_dataset.csv --out .
"""

import argparse
import os
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score


FEATURES = [
    'age',
    'no_of_days_subscribed',
    'multi_screen',
    'mail_subscribed',
    'weekly_mins_watched',
    'minimum_daily_mins',
    'maximum_daily_mins',
    'weekly_max_night_mins',
    'videos_watched',
    'maximum_days_inactive',
    'customer_support_calls',
]
TARGET = 'churn'


def load_and_preprocess(csv_path: str) -> tuple:
    df = pd.read_csv(csv_path)

    # Encode binary categorical columns
    df['multi_screen']    = df['multi_screen'].str.lower().map({'yes': 1, 'no': 0}).fillna(0)
    df['mail_subscribed'] = df['mail_subscribed'].str.lower().map({'yes': 1, 'no': 0}).fillna(0)

    # Drop rows with missing target
    df = df.dropna(subset=[TARGET])
    df[TARGET] = df[TARGET].astype(int)

    X = df[FEATURES].fillna(0)
    y = df[TARGET]
    return X, y


def train(csv_path: str, out_dir: str):
    print(f"Loading dataset: {csv_path}")
    X, y = load_and_preprocess(csv_path)
    print(f"  Samples: {len(X)}  |  Churn rate: {y.mean():.1%}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Scale features
    scaler  = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)

    # Train
    print("Training Random Forest …")
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_train, y_train)

    # Evaluate
    y_pred = clf.predict(X_test)
    acc    = accuracy_score(y_test, y_pred)
    print(f"\nTest Accuracy: {acc:.4f}\n")
    print(classification_report(y_test, y_pred, target_names=['Retained', 'Churned']))

    # Save artifacts
    os.makedirs(out_dir, exist_ok=True)
    model_path  = os.path.join(out_dir, 'model.pkl')
    scaler_path = os.path.join(out_dir, 'scaler.pkl')
    joblib.dump(clf,    model_path)
    joblib.dump(scaler, scaler_path)
    print(f"\nSaved → {model_path}")
    print(f"Saved → {scaler_path}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', default='../churn_dataset.csv', help='Path to CSV dataset')
    parser.add_argument('--out',  default='.',                    help='Output directory for .pkl files')
    args = parser.parse_args()
    train(args.data, args.out)

# Step 1: Initialize churn model training pipeline
# Handle missing values using basic imputation
