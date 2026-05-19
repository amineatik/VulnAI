#!/usr/bin/env python3
"""
Script d'import des données CVE depuis un fichier CSV
Utilisation: python import_cve_data.py
"""

import csv
import os
import sys
import re
from pathlib import Path

# Ajouter le dossier parent au path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
from models import Vulnerability, SeverityLevel, Base
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def detect_csv_format(file_path: str) -> dict:
    """Détecte le format du fichier CSV"""
    with open(file_path, 'r', encoding='utf-8') as f:
        sample = f.read(1024)
        
    # Détecter le délimiteur
    if ';' in sample:
        delimiter = ';'
    elif '\t' in sample:
        delimiter = '\t'
    else:
        delimiter = ','
    
    # Vérifier l'en-tête
    f.seek(0)
    reader = csv.DictReader(f, delimiter=delimiter)
    columns = reader.fieldnames
    
    # Mapper les colonnes
    mapping = {
        'cve_id': None,
        'title': None,
        'description': None,
        'severity': None,
        'cvss_score': None,
        'remediation': None
    }
    
    for col in columns:
        col_lower = col.lower()
        if 'cve' in col_lower and ('id' in col_lower or 'number' in col_lower):
            mapping['cve_id'] = col
        elif 'title' in col_lower or 'name' in col_lower or 'vuln' in col_lower:
            mapping['title'] = col
        elif 'desc' in col_lower or 'summary' in col_lower:
            mapping['description'] = col
        elif 'sever' in col_lower or 'critical' in col_lower:
            mapping['severity'] = col
        elif 'cvss' in col_lower or 'score' in col_lower:
            mapping['cvss_score'] = col
        elif 'remed' in col_lower or 'solution' in col_lower or 'fix' in col_lower:
            mapping['remediation'] = col
    
    return {
        'delimiter': delimiter,
        'columns': columns,
        'mapping': mapping
    }

def parse_severity(value: str) -> SeverityLevel:
    """Convertit une valeur de sévérité en enum"""
    if not value:
        return SeverityLevel.MEDIUM
    
    value_lower = str(value).lower()
    
    if value_lower in ['critical', 'critique', '9', '10', '9.0', '10.0']:
        return SeverityLevel.CRITICAL
    elif value_lower in ['high', 'haute', 'eleve', '7', '8', '7.0', '8.0']:
        return SeverityLevel.HIGH
    elif value_lower in ['medium', 'moyenne', 'moyen', '4', '5', '6']:
        return SeverityLevel.MEDIUM
    elif value_lower in ['low', 'basse', '1', '2', '3']:
        return SeverityLevel.LOW
    else:
        return SeverityLevel.MEDIUM

def parse_cvss_score(value: str) -> str:
    """Parse le score CVSS"""
    if not value:
        return 'N/A'
    
    # Extraire le nombre
    match = re.search(r'(\d+\.?\d*)', str(value))
    if match:
        score = float(match.group(1))
        return f"{score:.1f}"
    return 'N/A'

def import_cve_data(csv_file: str = "NVD_Cybersecurity_Dataset.csv"):
    """Importe les données depuis un fichier CSV"""
    
    print("\n" + "="*60)
    print(" IMPORT DES DONNÉES CVE")
    print("="*60)
    
    # Vérifier si le fichier existe
    if not os.path.exists(csv_file):
        print(f"❌ Fichier '{csv_file}' non trouvé!")
        print(f" Chemin actuel: {os.getcwd()}")
        
        # Chercher d'autres fichiers CSV
        csv_files = list(Path('.').glob('*.csv'))
        if csv_files:
            print(f"\n Fichiers CSV trouvés:")
            for f in csv_files:
                print(f"   - {f.name}")
            print(f"\n Utilisez: python import_cve_data.py --file <nom_fichier.csv>")
        return False
    
    print(f" Fichier trouvé: {csv_file}")
    
    # Créer les tables si elles n'existent pas
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Tables vérifiées/créées")
    except Exception as e:
        print(f"⚠️ Erreur création tables: {e}")
    
    db = SessionLocal()
    
    try:
        # Détecter le format
        format_info = detect_csv_format(csv_file)
        print(f" Délimiteur détecté: '{format_info['delimiter']}'")
        print(f" Colonnes: {format_info['columns'][:10]}...")
        
        mapping = format_info['mapping']
        print(f"\n Mapping des colonnes:")
        for key, value in mapping.items():
            print(f"   - {key}: {value if value else '⚠️ NON TROUVÉ'}")
        
        # Compter les CVEs existants
        existing_count = db.query(Vulnerability).count()
        print(f"\n CVEs existants dans la base: {existing_count}")
        
        if existing_count > 0:
            response = input(f"\n⚠️ {existing_count} CVEs existent. Supprimer avant import? (o/n) [n]: ")
            if response.lower() == 'o':
                db.query(Vulnerability).delete()
                db.commit()
                print("️ Anciens CVEs supprimés")
        
        # Lire et importer les données
        imported = 0
        errors = 0
        skipped = 0
        
        print("\n Import en cours...")
        
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter=format_info['delimiter'])
            
            for row_num, row in enumerate(reader, 1):
                try:
                    # Extraire les données
                    cve_id = row.get(mapping['cve_id']) if mapping['cve_id'] else f"CVE-{row_num}"
                    
                    # Nettoyer le CVE ID
                    if cve_id:
                        # Extraire le format CVE-YYYY-XXXX
                        cve_match = re.search(r'(CVE-\d{4}-\d{4,})', str(cve_id).upper())
                        if cve_match:
                            cve_id = cve_match.group(1)
                        else:
                            cve_id = f"CVE-{row_num}"
                    else:
                        cve_id = f"CVE-{row_num}"
                    
                    title = row.get(mapping['title']) if mapping['title'] else f"Vulnerability {cve_id}"
                    if title and len(title) > 500:
                        title = title[:497] + "..."
                    
                    description = row.get(mapping['description']) if mapping['description'] else title
                    if description and len(description) > 2000:
                        description = description[:1997] + "..."
                    
                    severity_str = row.get(mapping['severity']) if mapping['severity'] else None
                    severity = parse_severity(severity_str)
                    
                    cvss_score = parse_cvss_score(row.get(mapping['cvss_score']) if mapping['cvss_score'] else None)
                    
                    remediation = row.get(mapping['remediation']) if mapping['remediation'] else None
                    if not remediation:
                        remediation = "Appliquer les correctifs de sécurité recommandés par l'éditeur."
                    
                    # Vérifier si le CVE existe déjà
                    existing = db.query(Vulnerability).filter(Vulnerability.cve_id == cve_id).first()
                    if existing:
                        skipped += 1
                        continue
                    
                    # Créer la vulnérabilité
                    vuln = Vulnerability(
                        cve_id=cve_id,
                        title=str(title)[:500],
                        description=str(description),
                        severity=severity,
                        cvss_score=cvss_score,
                        remediation=str(remediation)[:500] if remediation else None,
                        status='open'
                    )
                    
                    db.add(vuln)
                    imported += 1
                    
                    # Commit par lots
                    if imported % 100 == 0:
                        db.commit()
                        print(f"    {imported} CVEs importés...")
                        
                except Exception as e:
                    errors += 1
                    if errors <= 10:
                        print(f"   ⚠️ Erreur ligne {row_num}: {e}")
                    continue
        
        # Commit final
        db.commit()
        
        # Afficher les résultats
        total = db.query(Vulnerability).count()
        
        print("\n" + "="*60)
        print(" IMPORT TERMINÉ!")
        print("="*60)
        print(f"✅ Importés: {imported}")
        print(f"⏭️  Ignorés (déjà existants): {skipped}")
        print(f"❌ Erreurs: {errors}")
        print(f" Total en base: {total}")
        
        # Afficher les statistiques par sévérité
        if total > 0:
            print("\n STATISTIQUES PAR SÉVÉRITÉ:")
            critical = db.query(Vulnerability).filter(Vulnerability.severity == SeverityLevel.CRITICAL).count()
            high = db.query(Vulnerability).filter(Vulnerability.severity == SeverityLevel.HIGH).count()
            medium = db.query(Vulnerability).filter(Vulnerability.severity == SeverityLevel.MEDIUM).count()
            low = db.query(Vulnerability).filter(Vulnerability.severity == SeverityLevel.LOW).count()
            
            print(f"    CRITICAL: {critical}")
            print(f"    HIGH: {high}")
            print(f"    MEDIUM: {medium}")
            print(f"    LOW: {low}")
            
            # Premier exemple
            first = db.query(Vulnerability).first()
            if first:
                print(f"\n Exemple de CVE importé:")
                print(f"   ID: {first.cve_id}")
                print(f"   Titre: {first.title[:100]}...")
                print(f"   Sévérité: {first.severity.value}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Erreur générale: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def main():
    """Point d'entrée principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Import CVE data from CSV')
    parser.add_argument('--file', '-f', type=str, default='NVD_Cybersecurity_Dataset.csv',
                       help='Nom du fichier CSV (défaut: NVD_Cybersecurity_Dataset.csv)')
    parser.add_argument('--force', action='store_true',
                       help='Supprimer les données existantes sans confirmation')
    
    args = parser.parse_args()
    
    if args.force:
        # Supprimer sans confirmation
        db = SessionLocal()
        count = db.query(Vulnerability).delete()
        db.commit()
        print(f"️ {count} CVEs supprimés")
        db.close()
    
    import_cve_data(args.file)

if __name__ == "__main__":
    main()